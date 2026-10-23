-- ROLLBACK-ONLY city policy integration test: bans must hide and refuse a
-- legal recipe in one city, without blocking owner recovery or touching cash.
begin;
do $smoke$
declare
 v_seller public.profiles%rowtype;
 v_buyer public.profiles%rowtype;
 v_batch uuid:=gen_random_uuid();
 v_rejected_listing uuid:=gen_random_uuid();
 v_listing uuid:=gen_random_uuid();
 v_now timestamptz:=clock_timestamp();
 v_json jsonb;
 v_buyer_cash bigint;
 v_seller_cash bigint;
begin
 if has_table_privilege('authenticated','public.cooking_food_stall_city_recipe_blocks','SELECT')
   or has_table_privilege('authenticated','public.cooking_food_stall_city_recipe_blocks','INSERT')
   or has_table_privilege('anon','public.cooking_food_stall_city_recipe_blocks','SELECT')
   or not has_table_privilege('service_role','public.cooking_food_stall_city_recipe_blocks','SELECT')
 then raise exception 'CITY_POLICY_CLIENT_PRIVILEGE_DRIFT'; end if;
 select * into v_seller from public.profiles p where p.is_active
   and p.deleted_at is null and p.died_at is null and p.is_traveling is distinct from true
   and p.current_city_id is not null and p.cash>=1000
   and exists(select 1 from public.profiles q where q.user_id<>p.user_id
     and q.current_city_id=p.current_city_id and q.is_active
     and q.deleted_at is null and q.died_at is null and q.cash>=1000
     and q.is_traveling is distinct from true)
 order by p.id limit 1;
 if not found then raise exception 'CITY_POLICY_NO_FIXTURE_CHARACTER_PAIR'; end if;
 select * into v_buyer from public.profiles q where q.user_id<>v_seller.user_id
   and q.current_city_id=v_seller.current_city_id
   and q.is_active and q.deleted_at is null and q.died_at is null and q.cash>=1000
   and q.is_traveling is distinct from true
 order by q.id limit 1;
 if exists(select 1 from public.cooking_food_stall_city_recipe_blocks cb
   where cb.city_id=v_seller.current_city_id and cb.recipe_slug='rice-bowl') then
   raise exception 'CITY_POLICY_TEST_REQUIRES_NO_EXISTING_RICE_BOWL_BLOCK';
 end if;
 v_seller_cash:=v_seller.cash;
 v_buyer_cash:=v_buyer.cash;
 update public.cooking_food_stall_controls set sales_enabled=true where singleton;
 insert into public.cooking_food_batches
   (id,profile_id,recipe_slug,origin_city_id,portions,quality,prepared_at,expires_at)
 values(v_batch,v_seller.id,'rice-bowl',v_seller.current_city_id,5,80,
        v_now-interval '5 minutes',v_now+interval '3 hours');
 perform set_config('request.jwt.claim.sub',v_seller.user_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object(
   'sub',v_seller.user_id,'role','authenticated','is_anonymous',false)::text,true);

 -- Ban an otherwise globally approved recipe for this one city.
 insert into public.cooking_food_stall_city_recipe_blocks(city_id,recipe_slug,blocked,reason)
 values(v_seller.current_city_id,'rice-bowl',true,'Rollback-only test city ban');
 begin
   perform public.create_cooking_food_stall_listing(
     v_seller.id,v_batch,2,100,v_now+interval '1 hour',v_rejected_listing);
   raise exception 'CITY_POLICY_BANNED_LISTING_ACCEPTED';
 exception when insufficient_privilege then null;
 end;
 if (select portions from public.cooking_food_batches where id=v_batch)<>5 then
   raise exception 'Banned listing spent edible food despite failed escrow';
 end if;

 -- Unban, list normally, then re-ban BEFORE a different user attempts purchase.
 update public.cooking_food_stall_city_recipe_blocks
 set blocked=false,updated_at=clock_timestamp()
 where city_id=v_seller.current_city_id and recipe_slug='rice-bowl';
 v_json:=public.create_cooking_food_stall_listing(
   v_seller.id,v_batch,2,100,v_now+interval '1 hour',v_listing);
 if v_json->>'status'<>'created' or
   (select portions from public.cooking_food_batches where id=v_batch)<>3 then
   raise exception 'Unblocked listing did not reserve food: %',v_json;
 end if;

 update public.cooking_food_stall_city_recipe_blocks
 set blocked=true,updated_at=clock_timestamp()
 where city_id=v_seller.current_city_id and recipe_slug='rice-bowl';

 perform set_config('request.jwt.claim.sub',v_buyer.user_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object(
   'sub',v_buyer.user_id,'role','authenticated','is_anonymous',false)::text,true);
 v_json:=public.browse_cooking_food_stalls(v_buyer.id,40);
 if (v_json->>'enabled')::boolean is distinct from true
   or exists(select 1 from jsonb_array_elements(v_json->'listings') r
      where r->>'id'=v_listing::text) then
   raise exception 'City-banned food remained discoverable';
 end if;
 begin
   perform public.purchase_cooking_food_stall_listing(
     v_buyer.id,v_listing,1,gen_random_uuid());
   raise exception 'CITY_POLICY_BANNED_PURCHASE_ACCEPTED';
 exception when insufficient_privilege then null;
 end;
 if (select cash from public.profiles where id=v_buyer.id)<>v_buyer_cash
   or (select cash from public.profiles where id=v_seller.id)<>v_seller_cash
   or exists(select 1 from public.cooking_food_stall_sales where listing_id=v_listing)
   or (select portions_remaining from public.cooking_food_stall_listings
     where id=v_listing)<>2 then
   raise exception 'Denied purchase changed stock or cash';
 end if;

 -- Sellers may reclaim fresh portions under a new city ban.
 perform set_config('request.jwt.claim.sub',v_seller.user_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object(
   'sub',v_seller.user_id,'role','authenticated','is_anonymous',false)::text,true);
 v_json:=public.cancel_cooking_food_stall_listing(v_seller.id,v_listing);
 if v_json->>'status'<>'closed' or (v_json->>'returnedPortions')::int<>2
   or (select portions from public.cooking_food_batches where id=v_batch)<>5
   or not exists(select 1 from public.cooking_food_stall_cancellation_events
      where listing_id=v_listing and returned_portions=2) then
   raise exception 'City ban prevented lawful owner cancellation: %',v_json;
 end if;
 raise notice 'CITY_POLICY_BAN_SQL_ROLLBACK_PASS';
end;
$smoke$;
rollback;
select jsonb_build_object(
 'sales_enabled',(select sales_enabled from public.cooking_food_stall_controls where singleton),
 'blocks',(select count(*) from public.cooking_food_stall_city_recipe_blocks),
 'listings',(select count(*) from public.cooking_food_stall_listings),
 'sales',(select count(*) from public.cooking_food_stall_sales),
 'cancellations',(select count(*) from public.cooking_food_stall_cancellation_events)
) as rollback_verified;
