-- Client-callable purchase with strong auth, one atomic cash/stock/lot/receipt
-- transaction, and global UUID idempotency. Market offers are disabled by
-- default; activation requires the first recipe and gateway E2E release gate.
create or replace function public.purchase_cooking_market_ingredient(
  p_profile_id uuid,
  p_offer_id uuid,
  p_quantity integer,
  p_request_id uuid
) returns jsonb
language plpgsql security definer set search_path=''
as $fn$
declare
 v_profile public.profiles%rowtype;
 v_offer public.cooking_city_market_offers%rowtype;
 v_ingredient public.cooking_market_ingredients%rowtype;
 v_receipt public.cooking_market_purchases%rowtype;
 v_total bigint;
 v_lot_id uuid;
 v_purchase_id uuid;
 v_expires timestamptz;
 v_now timestamptz;
begin
 if auth.uid() is null or p_profile_id is null or p_offer_id is null
   or p_request_id is null then
   raise exception 'COOKING_MARKET_AUTH_REQUIRED' using errcode='42501';
 end if;
 if coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
   raise exception 'COOKING_MARKET_AUTH_REQUIRED' using errcode='42501';
 end if;
 if p_quantity is null or p_quantity not between 1 and 20 then
   raise exception 'COOKING_MARKET_INVALID_QUANTITY' using errcode='22023';
 end if;

 -- PROFILE first: serializes simultaneous spending and duplicate receipts.
 select * into v_profile from public.profiles
 where id=p_profile_id and user_id=auth.uid()
   and is_active is true and died_at is null and deleted_at is null
 for update;
 if not found then
   raise exception 'COOKING_MARKET_CHARACTER_UNAVAILABLE' using errcode='42501';
 end if;
 select * into v_receipt from public.cooking_market_purchases
   where request_id=p_request_id;
 if found then
   if v_receipt.profile_id is distinct from p_profile_id
     or v_receipt.offer_id is distinct from p_offer_id
     or v_receipt.quantity is distinct from p_quantity then
     raise exception 'COOKING_MARKET_REQUEST_CONFLICT' using errcode='22023';
   end if;
   return jsonb_build_object('status','already_completed',
      'purchaseId',v_receipt.id,'ingredientLotId',v_receipt.ingredient_lot_id,
      'quantity',v_receipt.quantity,'totalPrice',v_receipt.total_price);
 end if;

 select * into v_offer from public.cooking_city_market_offers
 where id=p_offer_id for update;
 if not found or v_offer.is_active is distinct from true then
   raise exception 'COOKING_MARKET_OFFER_CLOSED' using errcode='22023';
 end if;
 if v_profile.current_city_id is null
   or v_profile.current_city_id is distinct from v_offer.city_id then
   raise exception 'COOKING_MARKET_NOT_IN_CITY' using errcode='42501';
 end if;
 if v_offer.stock < p_quantity then
   raise exception 'COOKING_MARKET_OUT_OF_STOCK' using errcode='22023';
 end if;

 select * into v_ingredient from public.cooking_market_ingredients
 where slug=v_offer.ingredient_slug for share;
 if not found or v_ingredient.shelf_life_hours not between 12 and 336
   or v_offer.quality not between 1 and 100
   or v_offer.unit_price not between 1 and 100000 then
   raise exception 'COOKING_MARKET_INVALID_CATALOGUE' using errcode='22023';
 end if;
 v_total := v_offer.unit_price * p_quantity::bigint;
 if v_total<1 or v_total>2000000 or v_profile.cash < v_total then
   raise exception 'COOKING_MARKET_INSUFFICIENT_FUNDS' using errcode='22023';
 end if;
 v_now := clock_timestamp();
 v_expires := v_now + make_interval(hours=>v_ingredient.shelf_life_hours);

 update public.cooking_city_market_offers
   set stock=stock-p_quantity,updated_at=v_now
   where id=v_offer.id and stock>=p_quantity;
 if not found then raise exception 'COOKING_MARKET_OUT_OF_STOCK'; end if;

 -- Existing cash sync trigger posts the financial journal in this same
 -- transaction. Failed downstream inserts also roll back the cash/journal.
 perform set_config('app.player_cash_context',jsonb_build_object(
    'classification','cooking_ingredient_purchase',
    'display_category','cooking_market',
    'description','Purchase ingredients at city market',
    'external_cash_flow',false,
    'idempotency_key','cooking_market:'||p_request_id::text,
    'cooking_offer_id',v_offer.id::text,
    'cooking_ingredient_slug',v_offer.ingredient_slug
   )::text,true);
 update public.profiles set cash=cash-v_total
   where id=v_profile.id and cash>=v_total;
 if not found then raise exception 'COOKING_MARKET_INSUFFICIENT_FUNDS'; end if;

 insert into public.cooking_ingredient_lots
   (profile_id,ingredient_slug,origin_city_id,quantity,quality,acquired_at,expires_at)
 values (v_profile.id,v_offer.ingredient_slug,v_offer.city_id,p_quantity,
    v_offer.quality,v_now,v_expires)
 returning id into v_lot_id;

 insert into public.cooking_market_purchases
   (request_id,user_id,profile_id,city_id,offer_id,ingredient_lot_id,
    quantity,unit_price,total_price,purchased_at)
 values (p_request_id,auth.uid(),v_profile.id,v_offer.city_id,v_offer.id,
    v_lot_id,p_quantity,v_offer.unit_price,v_total,v_now)
 returning id into v_purchase_id;
 return jsonb_build_object('status','completed','purchaseId',v_purchase_id,
   'ingredientLotId',v_lot_id,'ingredient',v_offer.ingredient_slug,
   'quantity',p_quantity,'totalPrice',v_total,'expiresAt',v_expires);
end;
$fn$;
revoke all on function public.purchase_cooking_market_ingredient(uuid,uuid,integer,uuid)
 from public,anon,authenticated;
grant execute on function public.purchase_cooking_market_ingredient(uuid,uuid,integer,uuid)
 to authenticated;
notify pgrst,'reload schema';
