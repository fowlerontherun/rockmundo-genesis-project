-- Add a local trading-rules notice to the existing authenticated city browse.
-- Only globally approved recipe names + local reasons are returned. No raw
-- policy table read privileges, no global list of city laws, and no writes.
-- Disabled markets return [] without exposing policy to non-players.
create or replace function cooking_internal.browse_cooking_food_stalls(
 p_profile_id uuid,p_limit integer default 40
) returns jsonb language plpgsql security definer set search_path=''
as $browse$
declare
 v_profile public.profiles%rowtype;
 v_enabled boolean;
 v_listings jsonb;
 v_restrictions jsonb;
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
     'cityId',v_profile.current_city_id,'listings','[]'::jsonb,
     'blockedRecipes','[]'::jsonb);
 end if;
 -- The server, not a client-supplied city or a public table grant,
 -- tells the player which otherwise approved dishes this city has blocked.
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'recipeSlug',cb.recipe_slug,'reason',cb.reason
 ) order by cb.recipe_slug),'[]'::jsonb) into v_restrictions
 from public.cooking_food_stall_city_recipe_blocks cb
 join public.cooking_food_stall_approved_recipes a
   on a.recipe_slug=cb.recipe_slug
 where cb.city_id=v_profile.current_city_id and cb.blocked=true;
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
   'cityId',v_profile.current_city_id,'listings',v_listings,
   'blockedRecipes',v_restrictions);
end;
$browse$;

revoke all on function cooking_internal.browse_cooking_food_stalls(uuid,integer)
 from public,anon,authenticated;
grant execute on function cooking_internal.browse_cooking_food_stalls(uuid,integer)
 to authenticated;
notify pgrst,'reload schema';
