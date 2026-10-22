-- Rollback-only integration test. Runs privileged SQL under a temporary JWT
-- claim, exercises the same authenticated contract and rolls back ALL effects.
do $test$
declare
 p public.profiles%rowtype;
 offer public.cooking_city_market_offers%rowtype;
 other_offer public.cooking_city_market_offers%rowtype;
 first_receipt jsonb;
 second_receipt jsonb;
 purchase_key uuid := gen_random_uuid();
 initial_cash bigint;
 initial_stock integer;
 after_cash bigint;
 after_stock integer;
 sale_count integer;
begin
 select * into p from public.profiles
 where is_active is true and died_at is null and deleted_at is null
   and current_city_id is not null and cash between 100 and 100000
 order by cash limit 1;
 if not found then
   raise notice 'SKIPPED: no eligible profile for market purchase test';
   return;
 end if;
 select * into offer from public.cooking_city_market_offers
 where city_id=p.current_city_id and stock >= 3 and is_active=false
 order by ingredient_slug limit 1;
 if not found then raise exception 'No closed market offer for test'; end if;
 select * into other_offer from public.cooking_city_market_offers
 where city_id<>p.current_city_id and stock>1 and is_active=false limit 1;
 if not found then raise exception 'No alternate-city offer for test'; end if;
 initial_cash := p.cash;
 initial_stock := offer.stock;
 perform set_config('request.jwt.claim.sub',p.user_id::text,true);
 perform set_config('request.jwt.claims',
   jsonb_build_object('sub',p.user_id::text,'role','authenticated','is_anonymous',false)::text,true);
 begin
   begin
     perform public.purchase_cooking_market_ingredient(p.id,offer.id,2,purchase_key);
     raise exception 'Closed market offer was purchasable';
   exception when others then
     if sqlerrm<>'COOKING_MARKET_OFFER_CLOSED' then raise; end if;
   end;

   update public.cooking_city_market_offers set is_active=true where id=offer.id;
   first_receipt := public.purchase_cooking_market_ingredient(p.id,offer.id,2,purchase_key);
   second_receipt := public.purchase_cooking_market_ingredient(p.id,offer.id,2,purchase_key);
   if first_receipt->>'status'<>'completed'
     or second_receipt->>'status'<>'already_completed'
     or first_receipt->>'purchaseId' is distinct from second_receipt->>'purchaseId' then
     raise exception 'Market purchase did not return an idempotent receipt';
   end if;

   select cash into after_cash from public.profiles where id=p.id;
   select stock into after_stock from public.cooking_city_market_offers where id=offer.id;
   if after_cash<>initial_cash-(first_receipt->>'totalPrice')::bigint then
     raise exception 'Purchase cash charged more or less than exactly once';
   end if;
   if after_stock<>initial_stock-2 then
     raise exception 'Stock did not decrement exactly twice';
   end if;
   select count(*) into sale_count from public.cooking_market_purchases
   where request_id=purchase_key;
   if sale_count<>1 then raise exception 'Duplicate market receipt'; end if;

   begin
     perform public.purchase_cooking_market_ingredient(p.id,offer.id,1,purchase_key);
     raise exception 'Idempotency key accepted changed quantity';
   exception when others then
     if sqlerrm<>'COOKING_MARKET_REQUEST_CONFLICT' then raise; end if;
   end;
   update public.cooking_city_market_offers set is_active=true where id=other_offer.id;
   begin
     perform public.purchase_cooking_market_ingredient(
       p.id,other_offer.id,1,gen_random_uuid());
     raise exception 'Player could buy from another city';
   exception when others then
     if sqlerrm<>'COOKING_MARKET_NOT_IN_CITY' then raise; end if;
   end;

   raise exception using errcode='PZ001', message='ROLLBACK_COOKING_MARKET_FIXTURE';
 exception when sqlstate 'PZ001' then
   raise notice 'PASS: disabled stock, idempotency, exact cash/stock, wrong city; fixture rolled back';
 end;
end $test$;
