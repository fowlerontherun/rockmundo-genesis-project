-- Atomic, server-authorised local food stall escrow and settlement.
-- DEPENDENCY: 20261022231500_cooking_food_stall_ledger_foundation.sql (PR #4548).
-- Release is OFF by default. Never activate without isolated staging E2E.
create table if not exists public.cooking_food_stall_controls (
  singleton boolean primary key default true check (singleton),
  sales_enabled boolean not null default false,
  fee_basis_points integer not null default 500 check (fee_basis_points between 0 and 1000),
  updated_at timestamptz not null default now()
);
insert into public.cooking_food_stall_controls(singleton,sales_enabled)
values(true,false) on conflict(singleton) do nothing;
alter table public.cooking_food_stall_controls enable row level security;
revoke all on public.cooking_food_stall_controls from public,anon,authenticated;

-- The listing is escrow: its available portions have already been atomically
-- removed from the original consumable batch. No other consumer can eat them.
-- The feature gate is checked inside the trigger as well as the RPCs.
create or replace function public.reject_unsecured_cooking_stall_open()
returns trigger language plpgsql set search_path='' as $guard$
begin
  if new.status='open' and (TG_OP='INSERT' or old.status is distinct from 'open') and (
     current_setting('app.cooking_stall_escrow_verified',true) is distinct from 'yes'
     or not exists(select 1 from public.cooking_food_stall_controls
       where singleton=true and sales_enabled=true)
   ) then
    raise exception 'COOKING_STALL_DISABLED_OR_UNVERIFIED' using errcode='42501';
  end if;
  return new;
end;
$guard$;
revoke all on function public.reject_unsecured_cooking_stall_open() from public,anon,authenticated;
alter table public.cooking_food_stall_sales
  alter column destination_batch_id set not null;

create or replace function public.create_cooking_food_stall_listing(
 p_profile_id uuid,p_food_batch_id uuid,p_portions integer,p_price_per_portion bigint,
 p_expires_at timestamptz,p_listing_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $listing$
declare
 v_profile public.profiles%rowtype;
 v_batch public.cooking_food_batches%rowtype;
 v_prior public.cooking_food_stall_listings%rowtype;
 v_id uuid;
 v_now timestamptz;
 v_expiry timestamptz;
 v_previous text := current_setting('app.cooking_stall_escrow_verified',true);
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
    or p_profile_id is null or p_food_batch_id is null or p_listing_id is null then
   raise exception 'COOKING_STALL_AUTH_REQUIRED' using errcode='42501';
 end if;
 if p_portions is null or p_portions not between 1 and 20
   or p_price_per_portion is null or p_price_per_portion not between 1 and 1000000
   or p_expires_at is null then
   raise exception 'COOKING_STALL_INVALID_LISTING' using errcode='22023';
 end if;
 if not exists(select 1 from public.cooking_food_stall_controls
     where singleton and sales_enabled) then
   raise exception 'COOKING_STALL_RELEASE_CLOSED' using errcode='42501';
 end if;
 -- Same lock used by eating and existing ingredient purchases.
 select * into v_profile from public.profiles
 where id=p_profile_id and user_id=auth.uid() and is_active=true
   and died_at is null and deleted_at is null and is_traveling is distinct from true
 for update;
 if not found or v_profile.current_city_id is null then
   raise exception 'COOKING_STALL_CHARACTER_UNAVAILABLE' using errcode='42501';
 end if;
 select * into v_prior from public.cooking_food_stall_listings
 where id=p_listing_id;
 if found then
   if v_prior.seller_profile_id is distinct from p_profile_id
     or v_prior.food_batch_id is distinct from p_food_batch_id
     or v_prior.portions_reserved is distinct from p_portions
     or v_prior.price_per_portion is distinct from p_price_per_portion then
     raise exception 'COOKING_STALL_LISTING_ID_CONFLICT' using errcode='22023';
   end if;
   return pg_catalog.jsonb_build_object('status','already_created','listingId',v_prior.id,
       'remaining',v_prior.portions_remaining,'listingStatus',v_prior.status);
 end if;
 select * into v_batch from public.cooking_food_batches
 where id=p_food_batch_id and profile_id=p_profile_id for update;
 v_now:=clock_timestamp();
 if not found or v_batch.portions<p_portions or v_batch.expires_at<=v_now
    or v_batch.prepared_at>v_now then
   raise exception 'COOKING_STALL_FOOD_UNAVAILABLE' using errcode='22023';
 end if;
 if not exists(select 1 from public.cooking_recipes
    where slug=v_batch.recipe_slug) then
   raise exception 'COOKING_STALL_UNKNOWN_RECIPE' using errcode='22023';
 end if;
 -- Never extend the original batch or offer a 7-day listing for 2-day food.
 v_expiry:=least(p_expires_at,v_batch.expires_at,v_now+interval '48 hours');
 if v_expiry<=v_now+interval '5 minutes' then
   raise exception 'COOKING_STALL_LISTING_TOO_SHORT' using errcode='22023';
 end if;
 update public.cooking_food_batches
 set portions=portions-p_portions where id=v_batch.id and portions>=p_portions;
 if not found then raise exception 'COOKING_STALL_ESCROW_FAILED'; end if;
 perform pg_catalog.set_config('app.cooking_stall_escrow_verified','yes',true);
 insert into public.cooking_food_stall_listings(
   id,seller_profile_id,city_id,food_batch_id,portions_reserved,portions_remaining,
   price_per_portion,status,expires_at,created_at,opened_at)
 values(p_listing_id,p_profile_id,v_profile.current_city_id,p_food_batch_id,
   p_portions,p_portions,p_price_per_portion,'open',v_expiry,v_now,v_now)
 returning id into v_id;
 perform pg_catalog.set_config('app.cooking_stall_escrow_verified',coalesce(v_previous,''),true);
 return pg_catalog.jsonb_build_object('status','created','listingId',v_id,
   'remaining',p_portions,'expiresAt',v_expiry);
end;
$listing$;

-- Cancellation is safe even after a release emergency stop. Unsold escrow is
-- returned only while the ORIGINAL food batch is still fresh.
create or replace function public.cancel_cooking_food_stall_listing(
 p_profile_id uuid,p_listing_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $cancel$
declare
 v_profile public.profiles%rowtype;
 v_listing public.cooking_food_stall_listings%rowtype;
 v_batch public.cooking_food_batches%rowtype;
 v_now timestamptz;
 v_returned integer := 0;
 v_status text;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
    or p_profile_id is null or p_listing_id is null then
   raise exception 'COOKING_STALL_AUTH_REQUIRED' using errcode='42501';
 end if;
 select * into v_profile from public.profiles where id=p_profile_id
   and user_id=auth.uid() and is_active=true and deleted_at is null and died_at is null
 for update;
 if not found then raise exception 'COOKING_STALL_NOT_OWNED' using errcode='42501'; end if;
 select * into v_listing from public.cooking_food_stall_listings
   where id=p_listing_id and seller_profile_id=p_profile_id for update;
 if not found then raise exception 'COOKING_STALL_NOT_OWNED' using errcode='42501'; end if;
 if v_listing.status <> 'open' then
   return pg_catalog.jsonb_build_object('status','already_closed',
     'listingId',v_listing.id,'listingStatus',v_listing.status);
 end if;
 v_now:=clock_timestamp();
 select * into v_batch from public.cooking_food_batches
   where id=v_listing.food_batch_id and profile_id=p_profile_id for update;
 if not found then raise exception 'COOKING_STALL_SOURCE_BATCH_MISSING'; end if;
 if v_now<v_batch.expires_at and v_now<v_listing.expires_at then
   update public.cooking_food_batches set portions=portions+v_listing.portions_remaining
   where id=v_batch.id and portions+v_listing.portions_remaining<=1000;
   if not found then raise exception 'COOKING_STALL_ESCROW_RETURN_FAILED'; end if;
   v_returned:=v_listing.portions_remaining;
   v_status:='cancelled';
 else
   -- If listing timed out but the food has not spoiled, unsold food can
   -- still be recovered; listing expiry itself does not spoil a batch.
   if v_now<v_batch.expires_at then
     update public.cooking_food_batches set portions=portions+v_listing.portions_remaining
     where id=v_batch.id and portions+v_listing.portions_remaining<=1000;
     if not found then raise exception 'COOKING_STALL_ESCROW_RETURN_FAILED'; end if;
     v_returned:=v_listing.portions_remaining;
   end if;
   v_status:='expired';
 end if;
 update public.cooking_food_stall_listings
 set status=v_status,portions_remaining=0,closed_at=v_now
 where id=v_listing.id;
 return pg_catalog.jsonb_build_object('status','closed','listingId',v_listing.id,
  'listingStatus',v_status,'returnedPortions',v_returned);
end;
$cancel$;

create or replace function public.purchase_cooking_food_stall_listing(
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

revoke all on function public.create_cooking_food_stall_listing(uuid,uuid,integer,bigint,timestamptz,uuid)
 from public,anon,authenticated;
revoke all on function public.cancel_cooking_food_stall_listing(uuid,uuid)
 from public,anon,authenticated;
revoke all on function public.purchase_cooking_food_stall_listing(uuid,uuid,integer,uuid)
 from public,anon,authenticated;
grant execute on function public.create_cooking_food_stall_listing(uuid,uuid,integer,bigint,timestamptz,uuid) to authenticated;
grant execute on function public.cancel_cooking_food_stall_listing(uuid,uuid) to authenticated;
grant execute on function public.purchase_cooking_food_stall_listing(uuid,uuid,integer,uuid) to authenticated;
notify pgrst,'reload schema';
