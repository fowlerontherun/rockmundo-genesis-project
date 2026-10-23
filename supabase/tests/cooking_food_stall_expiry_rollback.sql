-- Safe to run on production ONLY as a controlled privileged transaction.
-- All temporary fixtures and the feature-switch change are rolled back.
begin;
do $smoke$
declare
 v_seller public.profiles%rowtype;
 v_first uuid:=gen_random_uuid();
 v_second uuid:=gen_random_uuid();
 v_first_listing uuid:=gen_random_uuid();
 v_second_listing uuid:=gen_random_uuid();
 v_now timestamptz;
 v_closed integer;
begin
 if has_function_privilege('authenticated',
      'public.expire_cooking_food_stall_listings(integer)','EXECUTE')
    or has_function_privilege('anon',
      'public.expire_cooking_food_stall_listings(integer)','EXECUTE') then
   raise exception 'Client should not be able to run expiry sweep';
 end if;
 select * into v_seller from public.profiles
 where is_active=true and deleted_at is null and died_at is null
   and current_city_id is not null and is_traveling is distinct from true
 order by id limit 1;
 if not found then raise exception 'No suitable existing fixture profile'; end if;
 perform set_config('request.jwt.claim.sub',v_seller.user_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object(
    'sub',v_seller.user_id,'role','authenticated','is_anonymous',false)::text,true);
 update public.cooking_food_stall_controls set sales_enabled=true where singleton;
 insert into public.cooking_food_batches
  (id,profile_id,recipe_slug,origin_city_id,portions,quality,prepared_at,expires_at)
 values(v_first,v_seller.id,'rice-bowl',v_seller.current_city_id,4,85,
   clock_timestamp()-interval '1 hour',clock_timestamp()+interval '3 hours'),
 (v_second,v_seller.id,'rice-bowl',v_seller.current_city_id,4,85,
   clock_timestamp()-interval '1 hour',clock_timestamp()+interval '3 hours');
 perform public.create_cooking_food_stall_listing(
   v_seller.id,v_first,2,100,clock_timestamp()+interval '1 hour',v_first_listing);
 perform public.create_cooking_food_stall_listing(
   v_seller.id,v_second,2,100,clock_timestamp()+interval '1 hour',v_second_listing);
 if (select portions from public.cooking_food_batches where id=v_first)<>2 then
    raise exception 'Fixture escrow failed'; end if;

 -- Listing deadline has passed, but underlying food still fresh: return 2.
 update public.cooking_food_stall_listings set expires_at=clock_timestamp()-interval '1 second'
 where id=v_first_listing;
 -- Food itself has expired: record spoilage, NEVER restore portions.
 update public.cooking_food_batches set expires_at=clock_timestamp()-interval '1 second'
 where id=v_second;
 v_closed:=public.expire_cooking_food_stall_listings(10);
 if v_closed<>2 then raise exception 'Expected two expired listings, got %',v_closed; end if;
 if (select portions from public.cooking_food_batches where id=v_first)<>4
   or (select portions from public.cooking_food_batches where id=v_second)<>2 then
    raise exception 'Incorrect fresh return or spoiled food resurrection';
 end if;
 if not exists(select 1 from public.cooking_food_stall_expiry_events
   where listing_id=v_first_listing and returned_portions=2 and spoiled_portions=0)
 or not exists(select 1 from public.cooking_food_stall_expiry_events
   where listing_id=v_second_listing and returned_portions=0 and spoiled_portions=2)
 then raise exception 'Incorrect expiry audit'; end if;
 if exists(select 1 from public.cooking_food_stall_listings
    where id in(v_first_listing,v_second_listing)
     and (status<>'expired' or portions_remaining<>0 or closed_at is null)) then
   raise exception 'Expired listings were not terminal'; end if;
 if public.expire_cooking_food_stall_listings(10)<>0 then
   raise exception 'Repeated sweep tried to expire a second time'; end if;
 raise notice 'STAGING-SAFETY: expiration/return/spoilage/permission/retry assertions passed';
end;
$smoke$;
rollback;
select jsonb_build_object(
  'active',(select sales_enabled from public.cooking_food_stall_controls where singleton),
  'listings',(select count(*) from public.cooking_food_stall_listings),
  'sales',(select count(*) from public.cooking_food_stall_sales),
  'events',(select count(*) from public.cooking_food_stall_expiry_events)
) as after_rollback;
