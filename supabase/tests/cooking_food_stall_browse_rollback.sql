-- Database-local JWT smoke test. No data persists.
begin;
do $test$
declare
 seller public.profiles%rowtype;
 buyer public.profiles%rowtype;
 food_id uuid:=gen_random_uuid();
 listing_id uuid:=gen_random_uuid();
 payload jsonb;
begin
 if has_function_privilege('anon','public.browse_cooking_food_stalls(uuid,integer)','EXECUTE') then
   raise exception 'Anonymous market browse permission detected';
 end if;
 select * into seller from public.profiles s where s.is_active=true
 and s.deleted_at is null and s.died_at is null and s.current_city_id is not null
 and s.is_traveling is distinct from true
 and exists(select 1 from public.profiles b where b.user_id<>s.user_id
  and b.current_city_id=s.current_city_id and b.is_active=true
  and b.deleted_at is null and b.died_at is null
  and b.is_traveling is distinct from true)
 order by s.id limit 1;
 if not found then raise exception 'No two test users share a city'; end if;
 select * into buyer from public.profiles b
 where b.user_id<>seller.user_id and b.current_city_id=seller.current_city_id
 and b.is_active=true and b.deleted_at is null and b.died_at is null
 and b.is_traveling is distinct from true order by b.id limit 1;

 perform set_config('request.jwt.claim.sub',buyer.user_id::text,true);
 perform set_config('request.jwt.claims',
  jsonb_build_object('sub',buyer.user_id,'role','authenticated','is_anonymous',false)::text,true);
 payload:=public.browse_cooking_food_stalls(buyer.id,20);
 if (payload->>'enabled')::boolean is distinct from false
   or jsonb_array_length(payload->'listings')<>0 then
   raise exception 'Disabled market revealed offers';
 end if;
 update public.cooking_food_stall_controls set sales_enabled=true where singleton;
 perform set_config('request.jwt.claim.sub',seller.user_id::text,true);
 perform set_config('request.jwt.claims',
  jsonb_build_object('sub',seller.user_id,'role','authenticated','is_anonymous',false)::text,true);
 insert into public.cooking_food_batches
  (id,profile_id,recipe_slug,origin_city_id,portions,quality,prepared_at,expires_at)
 values(food_id,seller.id,'rice-bowl',seller.current_city_id,3,82,
   clock_timestamp()-interval '1 minute',clock_timestamp()+interval '3 hours');
 perform public.create_cooking_food_stall_listing(
    seller.id,food_id,2,150,clock_timestamp()+interval '1 hour',listing_id);
 -- Buyers never see listings from the same user/account.
 payload:=public.browse_cooking_food_stalls(seller.id,20);
 if exists (select 1 from jsonb_array_elements(payload->'listings') item
    where item->>'id'=listing_id::text) then
   raise exception 'Seller self listing should not appear to own account';
 end if;

 perform set_config('request.jwt.claim.sub',buyer.user_id::text,true);
 perform set_config('request.jwt.claims',
  jsonb_build_object('sub',buyer.user_id,'role','authenticated','is_anonymous',false)::text,true);
 payload:=public.browse_cooking_food_stalls(buyer.id,20);
 if payload->>'cityId' is distinct from buyer.current_city_id::text
   or (select count(*) from jsonb_array_elements(payload->'listings') item
       where item->>'id'=listing_id::text and item->>'recipeSlug'='rice-bowl'
          and (item->>'portions')::integer=2)<>1 then
   raise exception 'Local buyer cannot view eligible local food offer';
 end if;
 -- Player cannot choose a different owner's character to browse their city.
 begin
   perform public.browse_cooking_food_stalls(seller.id,20);
   raise exception 'Cross-profile browse unexpectedly succeeded';
 exception when insufficient_privilege then null;
 end;
 update public.cooking_food_stall_listings set expires_at=clock_timestamp()-interval '1 second'
 where id=listing_id;
 payload:=public.browse_cooking_food_stalls(buyer.id,20);
 if exists(select 1 from jsonb_array_elements(payload->'listings') item
   where item->>'id'=listing_id::text) then
   raise exception 'Expired listing was visible';
 end if;
end;
$test$;
rollback;
select jsonb_build_object('sales_enabled',(select sales_enabled from public.cooking_food_stall_controls where singleton),
 'listings',(select count(*) from public.cooking_food_stall_listings)) after_rollback;
