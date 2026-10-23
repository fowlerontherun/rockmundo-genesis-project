-- Server-enforced city-by-city recipe restrictions on legal food stall dishes.
-- Default: no city restrictions. Global legal whitelist still applies.
create table if not exists public.cooking_food_stall_city_recipe_blocks (
  city_id uuid not null references public.cities(id) on delete cascade,
  recipe_slug text not null check (char_length(recipe_slug) between 1 and 100),
  blocked boolean not null default true,
  reason text not null default 'Local food-market restriction'
     check (char_length(reason) between 1 and 250),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (city_id,recipe_slug)
);
alter table public.cooking_food_stall_city_recipe_blocks enable row level security;
revoke all on public.cooking_food_stall_city_recipe_blocks from public,anon,authenticated;
grant select,insert,update,delete on public.cooking_food_stall_city_recipe_blocks to service_role;
create policy "Trusted services inspect local food restrictions"
 on public.cooking_food_stall_city_recipe_blocks for select to service_role using (true);

-- Enforce bans on open listings and at sale settlement after policy changes.
-- Financial transfer is atomic: failure to insert sale receipt rolls back funds.
create or replace function public.guard_cooking_stall_legal_recipe()
returns trigger language plpgsql set search_path='' as $legal$
declare v_original_slug text; v_delivered_slug text;
begin
 if TG_TABLE_NAME='cooking_food_stall_listings' then
   if new.status='open' then
     select recipe_slug into v_original_slug from public.cooking_food_batches
       where id=new.food_batch_id and profile_id=new.seller_profile_id;
     if not exists(select 1 from public.cooking_food_stall_approved_recipes
        where recipe_slug=v_original_slug) then
       raise exception 'COOKING_STALL_RECIPE_NOT_APPROVED' using errcode='42501';
     end if;
     if exists(select 1 from public.cooking_food_stall_city_recipe_blocks cb
       where cb.city_id=new.city_id and cb.recipe_slug=v_original_slug
         and cb.blocked=true) then
       raise exception 'COOKING_STALL_CITY_RECIPE_BANNED' using errcode='42501';
     end if;
   end if;
 else
   select recipe_slug into v_delivered_slug from public.cooking_food_batches
     where id=new.destination_batch_id and profile_id=new.buyer_profile_id;
   select b.recipe_slug into v_original_slug from public.cooking_food_stall_listings l
     join public.cooking_food_batches b on b.id=l.food_batch_id
     where l.id=new.listing_id and b.profile_id=new.seller_profile_id;
   if v_original_slug is distinct from v_delivered_slug
      or not exists(select 1 from public.cooking_food_stall_approved_recipes
        where recipe_slug=v_original_slug) then
     raise exception 'COOKING_STALL_RECIPE_NOT_APPROVED' using errcode='42501';
   end if;
   if exists(select 1 from public.cooking_food_stall_city_recipe_blocks cb
     where cb.city_id=new.city_id and cb.recipe_slug=v_original_slug
       and cb.blocked=true) then
     raise exception 'COOKING_STALL_CITY_RECIPE_BANNED' using errcode='42501';
   end if;
 end if;
 return new;
end;
$legal$;

-- Local browse must hide existing listings banned after creation.
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
     and not exists (
       select 1 from public.cooking_food_stall_city_recipe_blocks cb
       where cb.city_id=l.city_id and cb.recipe_slug=b.recipe_slug and cb.blocked=true
     )
     and s.user_id is distinct from v_profile.user_id
     and s.is_active=true and s.deleted_at is null and s.died_at is null
   order by l.expires_at,l.id limit p_limit
 ) x;
 return pg_catalog.jsonb_build_object('enabled',true,
   'cityId',v_profile.current_city_id,'listings',v_listings);
end;
$browse$;

revoke all on function public.guard_cooking_stall_legal_recipe()
 from public,anon,authenticated;
revoke all on function cooking_internal.browse_cooking_food_stalls(uuid,integer)
 from public,anon;
grant execute on function cooking_internal.browse_cooking_food_stalls(uuid,integer)
 to authenticated;
notify pgrst,'reload schema';
