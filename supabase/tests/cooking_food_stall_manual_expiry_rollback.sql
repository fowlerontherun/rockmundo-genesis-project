-- Transaction-scoped regression: seller manually closes an expired listing,
-- with a recoverable source first, and a genuinely spoiled source second.
-- NO fixtures or feature-control changes persist after ROLLBACK.
begin;
do $test$
declare
 v_seller public.profiles%rowtype;
 v_fresh uuid:=gen_random_uuid();
 v_spoiled uuid:=gen_random_uuid();
 v_fresh_listing uuid:=gen_random_uuid();
 v_spoiled_listing uuid:=gen_random_uuid();
 v_result jsonb;
begin
 if has_table_privilege('anon',
   'public.cooking_food_stall_cancellation_events','SELECT')
 or has_table_privilege('authenticated',
   'public.cooking_food_stall_cancellation_events','INSERT')
 or not has_table_privilege('authenticated',
   'public.cooking_food_stall_cancellation_events','SELECT') then
   raise exception 'Cancellation receipt privilege drift';
 end if;
 select * into v_seller from public.profiles
 where is_active and deleted_at is null and died_at is null
   and current_city_id is not null and is_traveling is distinct from true
 order by id limit 1;
 if not found then raise exception 'No active test character available'; end if;
 perform set_config('request.jwt.claim.sub',v_seller.user_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object(
   'sub',v_seller.user_id,'role','authenticated','is_anonymous',false)::text,true);
 update public.cooking_food_stall_controls
 set sales_enabled=true where singleton;
 insert into public.cooking_food_batches
 (id,profile_id,recipe_slug,origin_city_id,portions,quality,prepared_at,expires_at)
 values (v_fresh,v_seller.id,'rice-bowl',v_seller.current_city_id,3,90,
   clock_timestamp()-interval '1 hour',clock_timestamp()+interval '3 hours'),
        (v_spoiled,v_seller.id,'apple-pie',v_seller.current_city_id,3,75,
   clock_timestamp()-interval '1 hour',clock_timestamp()+interval '3 hours');
 perform public.create_cooking_food_stall_listing(
   v_seller.id,v_fresh,2,150,clock_timestamp()+interval '1 hour',v_fresh_listing);
 perform public.create_cooking_food_stall_listing(
   v_seller.id,v_spoiled,2,150,clock_timestamp()+interval '1 hour',v_spoiled_listing);

 -- First fixture has stale *listing* but original source meal is fresh.
 update public.cooking_food_stall_listings
 set expires_at=clock_timestamp()-interval '1 second' where id=v_fresh_listing;
 v_result:=public.cancel_cooking_food_stall_listing(v_seller.id,v_fresh_listing);
 if v_result->>'listingStatus' <> 'expired'
   or (v_result->>'returnedPortions')::integer <> 2
   or (select portions from public.cooking_food_batches where id=v_fresh)<>3 then
   raise exception 'Manual listing expiry failed to return fresh escrow: %',v_result;
 end if;
 if not exists(select 1 from public.cooking_food_stall_expiry_events
    where listing_id=v_fresh_listing and returned_portions=2
      and spoiled_portions=0 and recipe_slug='rice-bowl' and quality=90) then
   raise exception 'Missing manual fresh expiry receipt';
 end if;

 -- Second fixture's original *food* has genuinely spoiled; do not revive it.
 update public.cooking_food_batches
 set expires_at=clock_timestamp()-interval '1 second' where id=v_spoiled;
 v_result:=public.cancel_cooking_food_stall_listing(v_seller.id,v_spoiled_listing);
 if v_result->>'listingStatus' <> 'expired'
   or (v_result->>'returnedPortions')::integer <> 0
   or (select portions from public.cooking_food_batches where id=v_spoiled)<>1 then
   raise exception 'Manual food expiry resurrected spoiled escrow: %',v_result;
 end if;
 if not exists(select 1 from public.cooking_food_stall_expiry_events
   where listing_id=v_spoiled_listing and returned_portions=0
     and spoiled_portions=2 and recipe_slug='apple-pie' and quality=75) then
   raise exception 'Missing spoiled manual expiry receipt';
 end if;

 if public.cancel_cooking_food_stall_listing(v_seller.id,v_spoiled_listing)->>
    'status'<>'already_closed'
   or (select count(*) from public.cooking_food_stall_expiry_events
     where listing_id in (v_fresh_listing,v_spoiled_listing))<>2
   or exists(select 1 from public.cooking_food_stall_cancellation_events
     where listing_id in (v_fresh_listing,v_spoiled_listing)) then
   raise exception 'Manual expiry generated duplicate or misclassified receipt';
 end if;
end;
$test$;
rollback;
select jsonb_build_object(
 'enabled',(select sales_enabled from public.cooking_food_stall_controls where singleton),
 'sales',(select count(*) from public.cooking_food_stall_sales),
 'listings',(select count(*) from public.cooking_food_stall_listings),
 'cancellations',(select count(*) from public.cooking_food_stall_cancellation_events),
 'expiry_events',(select count(*) from public.cooking_food_stall_expiry_events)
) as rollback_verified;
