-- Keep future restricted recipes OUT of the public food marketplace.
-- Only explicitly approved legal starter recipes may be listed or bought.
create table if not exists public.cooking_food_stall_approved_recipes (
 recipe_slug text primary key references public.cooking_recipes(slug) on delete restrict,
 approved_at timestamptz not null default now()
);
insert into public.cooking_food_stall_approved_recipes(recipe_slug)
select slug from public.cooking_recipes where slug in (
 'vegetable-soup','onion-soup','tomato-soup','lentil-stew',
 'apple-pie','fruit-tart','citrus-cake','tea-cakes','rice-bowl',
 'bean-stew','spiced-tea','fruit-drink'
) on conflict (recipe_slug) do nothing;
alter table public.cooking_food_stall_approved_recipes enable row level security;
revoke all on public.cooking_food_stall_approved_recipes from public,anon,authenticated;

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
 end if;
 return new;
end;
$legal$;
drop trigger if exists cooking_stall_legal_listing on public.cooking_food_stall_listings;
create trigger cooking_stall_legal_listing
 before insert or update on public.cooking_food_stall_listings
 for each row execute function public.guard_cooking_stall_legal_recipe();
drop trigger if exists cooking_stall_legal_sale on public.cooking_food_stall_sales;
create trigger cooking_stall_legal_sale
 before insert on public.cooking_food_stall_sales
 for each row execute function public.guard_cooking_stall_legal_recipe();
revoke all on function public.guard_cooking_stall_legal_recipe() from public,anon,authenticated;

-- Supabase's preferred pattern: privileged implementation in non-exposed
-- cooking_internal, explicitly authorized invoker wrappers in public.
alter function public.create_cooking_food_stall_listing(uuid,uuid,integer,bigint,timestamptz,uuid)
 set schema cooking_internal;
alter function public.cancel_cooking_food_stall_listing(uuid,uuid)
 set schema cooking_internal;
alter function public.purchase_cooking_food_stall_listing(uuid,uuid,integer,uuid)
 set schema cooking_internal;

revoke all on function cooking_internal.create_cooking_food_stall_listing(uuid,uuid,integer,bigint,timestamptz,uuid)
 from public,anon,authenticated;
revoke all on function cooking_internal.cancel_cooking_food_stall_listing(uuid,uuid)
 from public,anon,authenticated;
revoke all on function cooking_internal.purchase_cooking_food_stall_listing(uuid,uuid,integer,uuid)
 from public,anon,authenticated;
grant execute on function cooking_internal.create_cooking_food_stall_listing(uuid,uuid,integer,bigint,timestamptz,uuid)
 to authenticated;
grant execute on function cooking_internal.cancel_cooking_food_stall_listing(uuid,uuid)
 to authenticated;
grant execute on function cooking_internal.purchase_cooking_food_stall_listing(uuid,uuid,integer,uuid)
 to authenticated;

create function public.create_cooking_food_stall_listing(
 p_profile_id uuid,p_food_batch_id uuid,p_portions integer,p_price_per_portion bigint,
 p_expires_at timestamptz,p_listing_id uuid
) returns jsonb language sql security invoker set search_path='' as $$
 select cooking_internal.create_cooking_food_stall_listing(
  p_profile_id,p_food_batch_id,p_portions,p_price_per_portion,p_expires_at,p_listing_id);
$$;
create function public.cancel_cooking_food_stall_listing(
 p_profile_id uuid,p_listing_id uuid
) returns jsonb language sql security invoker set search_path='' as $$
 select cooking_internal.cancel_cooking_food_stall_listing(p_profile_id,p_listing_id);
$$;
create function public.purchase_cooking_food_stall_listing(
 p_buyer_profile_id uuid,p_listing_id uuid,p_portions integer,p_request_id uuid
) returns jsonb language sql security invoker set search_path='' as $$
 select cooking_internal.purchase_cooking_food_stall_listing(
   p_buyer_profile_id,p_listing_id,p_portions,p_request_id);
$$;
revoke all on function public.create_cooking_food_stall_listing(uuid,uuid,integer,bigint,timestamptz,uuid) from public,anon,authenticated;
revoke all on function public.cancel_cooking_food_stall_listing(uuid,uuid) from public,anon,authenticated;
revoke all on function public.purchase_cooking_food_stall_listing(uuid,uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.create_cooking_food_stall_listing(uuid,uuid,integer,bigint,timestamptz,uuid) to authenticated;
grant execute on function public.cancel_cooking_food_stall_listing(uuid,uuid) to authenticated;
grant execute on function public.purchase_cooking_food_stall_listing(uuid,uuid,integer,uuid) to authenticated;
notify pgrst,'reload schema';
