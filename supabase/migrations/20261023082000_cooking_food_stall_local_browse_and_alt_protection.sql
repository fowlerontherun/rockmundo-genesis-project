-- Authenticated local city browse, closed by default. No broad RLS rule that
-- would reveal private seller inventory or let callers choose a distant city.
-- Also block self-trading via a second character on the same user account.
create or replace function cooking_internal.purchase_cooking_food_stall_listing(
 p_buyer_profile_id uuid,p_listing_id uuid,p_portions integer,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $purchase$
declare
 v_listing public.cooking_food_stall_listings%rowtype;
 v_buyer public.profiles%rowtype;
 v_seller public.profiles%rowtype;
 v_original public.cooking_food_batches%rowtype;
 v_prior public.cooking_food_stall_sales%rowtype;
 v_fee_bp integer;
 v_subtotal bigint;
 v_fee bigint;
 v_proceeds bigint;
 v_new_batch uuid;
 v_receipt uuid;
 v_now timestamptz;
 v_prior_cash_context text := current_setting('app.player_cash_context',true);
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
   or p_buyer_profile_id is null or p_listing_id is null or p_request_id is null then
   raise exception 'COOKING_STALL_AUTH_REQUIRED' using errcode='42501';
 end if;
 if p_portions is null or p_portions not between 1 and 20 then
   raise exception 'COOKING_STALL_INVALID_PORTIONS' using errcode='22023';
 end if;
 select fee_basis_points into v_fee_bp from public.cooking_food_stall_controls
 where singleton and sales_enabled for share;
 if not found then raise exception 'COOKING_STALL_RELEASE_CLOSED' using errcode='42501'; end if;
 -- Listing owner is identified before locking profiles but not trusted until
 -- the locked listing is re-read and checked again below.
 select * into v_listing from public.cooking_food_stall_listings where id=p_listing_id;
 if not found then raise exception 'COOKING_STALL_LISTING_NOT_FOUND' using errcode='22023'; end if;
 if v_listing.seller_profile_id=p_buyer_profile_id then
   raise exception 'COOKING_STALL_SELF_TRADE' using errcode='42501';
 end if;
 -- Deterministic UUID order prevents opposing player trades deadlocking.
 perform 1 from public.profiles
 where id in (p_buyer_profile_id,v_listing.seller_profile_id)
 order by id for update;
 select * into v_buyer from public.profiles where id=p_buyer_profile_id
   and user_id=auth.uid() and is_active=true
   and died_at is null and deleted_at is null and is_traveling is distinct from true;
 if not found then raise exception 'COOKING_STALL_BUYER_NOT_OWNED' using errcode='42501'; end if;
 select * into v_seller from public.profiles where id=v_listing.seller_profile_id
   and is_active=true and died_at is null and deleted_at is null;
 if not found then raise exception 'COOKING_STALL_SELLER_INACTIVE' using errcode='22023'; end if;
 if v_seller.user_id is not distinct from v_buyer.user_id then
   raise exception 'COOKING_STALL_SAME_ACCOUNT_TRADE' using errcode='42501';
 end if;
 select * into v_prior from public.cooking_food_stall_sales where purchase_id=p_request_id;
 if found then
   if v_prior.listing_id is distinct from p_listing_id
     or v_prior.buyer_profile_id is distinct from p_buyer_profile_id
     or v_prior.portions is distinct from p_portions then
     raise exception 'COOKING_STALL_REQUEST_ID_CONFLICT' using errcode='22023';
   end if;
   return pg_catalog.jsonb_build_object('status','already_completed',
     'saleId',v_prior.id,'batchId',v_prior.destination_batch_id,
     'subtotal',v_prior.subtotal,'fee',v_prior.city_fee);
 end if;
 select * into v_listing from public.cooking_food_stall_listings
   where id=p_listing_id for update;
 v_now:=clock_timestamp();
 if not found or v_listing.status<>'open'
    or v_listing.seller_profile_id is distinct from v_seller.id
    or v_listing.expires_at<=v_now or v_listing.portions_remaining<p_portions then
   raise exception 'COOKING_STALL_LISTING_UNAVAILABLE' using errcode='22023';
 end if;
 if v_buyer.current_city_id is distinct from v_listing.city_id then
   raise exception 'COOKING_STALL_NOT_IN_CITY' using errcode='42501';
 end if;
 select * into v_original from public.cooking_food_batches
   where id=v_listing.food_batch_id and profile_id=v_seller.id;
 if not found or v_original.expires_at<=v_now or v_original.prepared_at>v_now then
   raise exception 'COOKING_STALL_BATCH_EXPIRED' using errcode='22023';
 end if;
 v_subtotal:=v_listing.price_per_portion*p_portions::bigint;
 v_fee:=floor(v_subtotal*v_fee_bp::numeric/10000)::bigint;
 v_proceeds:=v_subtotal-v_fee;
 if v_subtotal<1 or v_subtotal>20000000 or v_buyer.cash<v_subtotal then
   raise exception 'COOKING_STALL_INSUFFICIENT_CASH' using errcode='22023';
 end if;
 -- Transfer a new child batch with unchanged preparation time/expiry/quality.
 insert into public.cooking_food_batches(
   profile_id,recipe_slug,origin_city_id,portions,quality,prepared_at,expires_at)
 values(v_buyer.id,v_original.recipe_slug,v_original.origin_city_id,p_portions,
   v_original.quality,v_original.prepared_at,v_original.expires_at)
 returning id into v_new_batch;

 perform pg_catalog.set_config('app.player_cash_context',
   pg_catalog.jsonb_build_object('classification','cooking_stall_purchase',
    'display_category','cooking_market','description','Buy cooked food at local stall',
    'external_cash_flow',false,'idempotency_key','cooking_stall:buy:'||p_request_id::text)::text,true);
 update public.profiles set cash=cash-v_subtotal
 where id=v_buyer.id and cash>=v_subtotal;
 if not found then raise exception 'COOKING_STALL_INSUFFICIENT_CASH'; end if;
 perform pg_catalog.set_config('app.player_cash_context',
   pg_catalog.jsonb_build_object('classification','cooking_stall_sale',
    'display_category','cooking_market','description','Sell cooked food at local stall',
    'external_cash_flow',false,'idempotency_key','cooking_stall:sell:'||p_request_id::text)::text,true);
 update public.profiles set cash=cash+v_proceeds where id=v_seller.id;
 perform pg_catalog.set_config('app.player_cash_context',coalesce(v_prior_cash_context,''),true);

 update public.cooking_food_stall_listings
 set portions_remaining=portions_remaining-p_portions,
   status=case when portions_remaining=p_portions then 'sold' else 'open' end,
   closed_at=case when portions_remaining=p_portions then v_now else null end
 where id=p_listing_id and portions_remaining>=p_portions;
 if not found then raise exception 'COOKING_STALL_CONCURRENT_SALE'; end if;

 insert into public.cooking_food_stall_sales(
   purchase_id,listing_id,buyer_profile_id,seller_profile_id,city_id,
   portions,unit_price,subtotal,city_fee,seller_proceeds,destination_batch_id,purchased_at)
 values(p_request_id,v_listing.id,v_buyer.id,v_seller.id,v_listing.city_id,
  p_portions,v_listing.price_per_portion,v_subtotal,v_fee,v_proceeds,v_new_batch,v_now)
 returning id into v_receipt;

 if v_fee>0 then
   perform public.credit_city_treasury(v_listing.city_id,v_fee,
      'cooking_food_stall_fee','Local prepared food marketplace fee',v_receipt);
 end if;
 return pg_catalog.jsonb_build_object('status','completed','saleId',v_receipt,
   'batchId',v_new_batch,'subtotal',v_subtotal,'fee',v_fee,
   'remaining',v_listing.portions_remaining-p_portions);
end;
$purchase$;

create or replace function cooking_internal.browse_cooking_food_stalls(
 p_profile_id uuid,p_limit integer default 40
) returns jsonb language plpgsql security definer set search_path=''
as $browse$
declare
 v_profile public.profiles%rowtype;
 v_enabled boolean;
 v_listings jsonb;
begin
 if auth.uid() is null or p_profile_id is null
   or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
   raise exception 'COOKING_STALL_AUTH_REQUIRED' using errcode='42501';
 end if;
 if p_limit is null or p_limit not between 1 and 50 then
   raise exception 'COOKING_STALL_INVALID_BROWSE_LIMIT' using errcode='22023';
 end if;
 select * into v_profile from public.profiles
 where id=p_profile_id and user_id=auth.uid() and is_active=true
   and died_at is null and deleted_at is null and is_traveling is distinct from true;
 if not found or v_profile.current_city_id is null then
   raise exception 'COOKING_STALL_CHARACTER_UNAVAILABLE' using errcode='42501';
 end if;
 select sales_enabled into v_enabled from public.cooking_food_stall_controls where singleton;
 if v_enabled is distinct from true then
   return pg_catalog.jsonb_build_object('enabled',false,
     'cityId',v_profile.current_city_id,'listings','[]'::jsonb);
 end if;
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'id',x.id,'recipeSlug',x.recipe_slug,'sellerName',x.seller_name,
   'quality',x.quality,'pricePerPortion',x.price_per_portion,
   'portions',x.portions_remaining,'expiresAt',x.expires_at,
   'batchExpiresAt',x.batch_expires_at,'originCityId',x.origin_city_id
 ) order by x.expires_at,x.id),'[]'::jsonb) into v_listings
 from (
   select l.id,b.recipe_slug,
      coalesce(nullif(s.display_name,''),nullif(s.username,''),'Local cook') seller_name,
      b.quality,l.price_per_portion,l.portions_remaining,l.expires_at,
      b.expires_at batch_expires_at,b.origin_city_id
   from public.cooking_food_stall_listings l
   join public.cooking_food_batches b on b.id=l.food_batch_id
   join public.profiles s on s.id=l.seller_profile_id
   join public.cooking_food_stall_approved_recipes a on a.recipe_slug=b.recipe_slug
   where l.city_id=v_profile.current_city_id
     and l.status='open' and l.portions_remaining>0
     and l.expires_at>clock_timestamp() and b.expires_at>clock_timestamp()
     and s.user_id is distinct from v_profile.user_id
     and s.is_active=true and s.deleted_at is null and s.died_at is null
   order by l.expires_at,l.id limit p_limit
 ) x;
 return pg_catalog.jsonb_build_object('enabled',true,
   'cityId',v_profile.current_city_id,'listings',v_listings);
end;
$browse$;
revoke all on function cooking_internal.browse_cooking_food_stalls(uuid,integer)
 from public,anon,authenticated;
grant execute on function cooking_internal.browse_cooking_food_stalls(uuid,integer) to authenticated;
create or replace function public.browse_cooking_food_stalls(
 p_profile_id uuid,p_limit integer default 40
) returns jsonb language sql security invoker set search_path=''
as $wrapper$
 select cooking_internal.browse_cooking_food_stalls(p_profile_id,p_limit);
$wrapper$;
revoke all on function public.browse_cooking_food_stalls(uuid,integer) from public,anon,authenticated;
grant execute on function public.browse_cooking_food_stalls(uuid,integer) to authenticated;
notify pgrst,'reload schema';
