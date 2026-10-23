-- ROLLBACK-ONLY. Uses two existing active characters in one city.
-- Direct signed-in browser and multi-connection concurrency remain separate gates.
begin;
do $test$
declare
 v_seller public.profiles%rowtype;
 v_buyer public.profiles%rowtype;
 v_id uuid:=gen_random_uuid();
 v_listing uuid:=gen_random_uuid();
 v_request uuid:=gen_random_uuid();
 v_other uuid:=gen_random_uuid();
 v_created jsonb;
 v_bought jsonb;
 v_retry jsonb;
 v_closed jsonb;
 v_batch public.cooking_food_batches%rowtype;
 v_before_seller bigint;
 v_before_buyer bigint;
 v_before_city bigint;
 v_after bigint;
begin
 select * into v_seller from public.profiles p
 where p.is_active and p.deleted_at is null and p.died_at is null
   and p.current_city_id is not null and p.cash>=1000
   and exists(select 1 from public.profiles b where b.user_id<>p.user_id
     and b.current_city_id=p.current_city_id and b.is_active
     and b.deleted_at is null and b.died_at is null and b.cash>=1000)
 order by p.id limit 1;
 if not found then raise exception 'No safe test character pair exists'; end if;
 select * into v_buyer from public.profiles b where b.user_id<>v_seller.user_id
   and b.current_city_id=v_seller.current_city_id
   and b.is_active and b.deleted_at is null and b.died_at is null and b.cash>=1000
 order by b.id limit 1;
 select cash into v_before_seller from public.profiles where id=v_seller.id;
 select cash into v_before_buyer from public.profiles where id=v_buyer.id;
 select balance into v_before_city from public.city_treasury where city_id=v_seller.current_city_id;
 v_before_city:=coalesce(v_before_city,0);
 perform set_config('request.jwt.claim.sub',v_seller.user_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_seller.user_id::text,'role','authenticated','is_anonymous',false)::text,true);

 insert into public.cooking_food_batches
   (id,profile_id,recipe_slug,origin_city_id,portions,quality,prepared_at,expires_at)
 values(v_id,v_seller.id,'rice-bowl',v_seller.current_city_id,5,80,clock_timestamp()-interval '5 minutes',clock_timestamp()+interval '3 hours')
 returning * into v_batch;

 begin
   perform public.create_cooking_food_stall_listing(v_seller.id,v_id,3,100,clock_timestamp()+interval '2 hours',v_listing);
   raise exception 'Release gate unexpectedly accepted a listing';
 exception when insufficient_privilege then null;
 end;

 update public.cooking_food_stall_controls set sales_enabled=true,updated_at=clock_timestamp()
 where singleton=true;
 v_created:=public.create_cooking_food_stall_listing(v_seller.id,v_id,3,100,clock_timestamp()+interval '2 hours',v_listing);
 if v_created->>'status'<>'created' then raise exception 'Listing not created: %',v_created; end if;
 if (select portions from public.cooking_food_batches where id=v_id)<>2 then
   raise exception 'Escrow did not remove exactly 3 edible portions';
 end if;
 v_retry:=public.create_cooking_food_stall_listing(v_seller.id,v_id,3,100,clock_timestamp()+interval '2 hours',v_listing);
 if v_retry->>'status'<>'already_created' or
    (select portions from public.cooking_food_batches where id=v_id)<>2 then
   raise exception 'Listing retry took additional food';
 end if;

 perform set_config('request.jwt.claim.sub',v_buyer.user_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_buyer.user_id::text,'role','authenticated','is_anonymous',false)::text,true);
 v_bought:=public.purchase_cooking_food_stall_listing(v_buyer.id,v_listing,2,v_request);
 if v_bought->>'status'<>'completed' or (v_bought->>'subtotal')::bigint<>200
   or (v_bought->>'fee')::bigint<>10 then
   raise exception 'Purchase quote wrong: %',v_bought;
 end if;
 if not exists(select 1 from public.cooking_food_batches b where b.id=(v_bought->>'batchId')::uuid
    and b.profile_id=v_buyer.id and b.portions=2 and b.quality=v_batch.quality
    and b.expires_at=v_batch.expires_at and b.prepared_at=v_batch.prepared_at) then
   raise exception 'Purchased food was minted with a changed source expiry or owner';
 end if;
 v_retry:=public.purchase_cooking_food_stall_listing(v_buyer.id,v_listing,2,v_request);
 if v_retry->>'status'<>'already_completed' then
   raise exception 'Duplicate purchase created additional stock';
 end if;
 if (select count(*) from public.cooking_food_stall_sales where purchase_id=v_request)<>1 then
   raise exception 'Duplicate sale receipt';
 end if;
 if (select cash from public.profiles where id=v_buyer.id)<>v_before_buyer-200
   or (select cash from public.profiles where id=v_seller.id)<>v_before_seller+190
   or coalesce((select balance from public.city_treasury where city_id=v_seller.current_city_id),0)<>v_before_city+10 then
   raise exception 'Buyer/seller/city money did not reconcile';
 end if;
 begin
   perform public.purchase_cooking_food_stall_listing(v_buyer.id,v_listing,2,v_other);
   raise exception 'Oversell unexpectedly succeeded';
 exception when invalid_parameter_value then null;
 end;

 perform set_config('request.jwt.claim.sub',v_seller.user_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_seller.user_id::text,'role','authenticated','is_anonymous',false)::text,true);
 v_closed:=public.cancel_cooking_food_stall_listing(v_seller.id,v_listing);
 if v_closed->>'status'<>'closed' or (v_closed->>'returnedPortions')::int<>1
    or (select portions from public.cooking_food_batches where id=v_id)<>3 then
   raise exception 'Unsold escrow not returned: %',v_closed;
 end if;
 if public.cancel_cooking_food_stall_listing(v_seller.id,v_listing)->>'status'<> 'already_closed' then
   raise exception 'Duplicate cancellation reopened listing';
 end if;
 raise notice 'cooking_stall_test_passed (all fixture transactions will rollback)';
end;
$test$;
rollback;
select jsonb_build_object(
  'remaining_listings',(select count(*) from public.cooking_food_stall_listings),
  'remaining_sales',(select count(*) from public.cooking_food_stall_sales),
  'release_enabled',(select sales_enabled from public.cooking_food_stall_controls where singleton)) as rollback_verified;
