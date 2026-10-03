-- Link saved Merch Studio apparel to avatar wearables without duplicating garment meshes.
create table if not exists public.player_merch_wearables (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  design_id uuid not null references public.tshirt_designs(id) on delete cascade,
  equipped_at timestamptz not null default now()
);

alter table public.player_merch_wearables enable row level security;

drop policy if exists "Players can view own merch wearable" on public.player_merch_wearables;
create policy "Players can view own merch wearable" on public.player_merch_wearables
for select to authenticated
using (profile_id in (select id from public.profiles where user_id = auth.uid()));

drop policy if exists "Players can equip own band merch" on public.player_merch_wearables;
create policy "Players can equip own band merch" on public.player_merch_wearables
for insert to authenticated
with check (
  profile_id in (select id from public.profiles where user_id = auth.uid())
  and exists (
    select 1
    from public.tshirt_designs td
    join public.band_members bm on bm.band_id = td.band_id
    where td.id = design_id
      and bm.profile_id = player_merch_wearables.profile_id
      and bm.member_status = 'active'
      and lower(coalesce(td.product_type, '')) in (
        'basic tee','graphic tee','heavyweight tee','long sleeve tee',
        'premium hoodie','zip hoodie','tour crewneck','football shirt'
      )
  )
);

drop policy if exists "Players can change own band merch" on public.player_merch_wearables;
create policy "Players can change own band merch" on public.player_merch_wearables
for update to authenticated
using (profile_id in (select id from public.profiles where user_id = auth.uid()))
with check (
  profile_id in (select id from public.profiles where user_id = auth.uid())
  and exists (
    select 1
    from public.tshirt_designs td
    join public.band_members bm on bm.band_id = td.band_id
    where td.id = design_id
      and bm.profile_id = player_merch_wearables.profile_id
      and bm.member_status = 'active'
  )
);

drop policy if exists "Players can unequip own band merch" on public.player_merch_wearables;
create policy "Players can unequip own band merch" on public.player_merch_wearables
for delete to authenticated
using (profile_id in (select id from public.profiles where user_id = auth.uid()));

create or replace function public.get_stage_merch_wearables(p_profile_ids uuid[])
returns table (
  profile_id uuid,
  design_id uuid,
  band_id uuid,
  design_name text,
  product_type text,
  artwork_url text,
  garment_color text,
  design_data jsonb
)
language sql stable security invoker set search_path = public
as $$
  select w.profile_id, d.id, d.band_id, d.design_name, d.product_type, d.artwork_url,
         coalesce(d.design_data->>'garmentColor', d.background_color, '#171717') as garment_color,
         d.design_data
  from public.player_merch_wearables w
  join public.tshirt_designs d on d.id = w.design_id
  where w.profile_id = any(p_profile_ids)
    and lower(coalesce(d.product_type, '')) in (
      'basic tee','graphic tee','heavyweight tee','long sleeve tee',
      'premium hoodie','zip hoodie','tour crewneck','football shirt'
    );
$$;
grant execute on function public.get_stage_merch_wearables(uuid[]) to authenticated;

comment on table public.player_merch_wearables is
  'One equipped Merch Studio apparel design per player. Rendering reuses approved V1 garment silhouettes; the design remains canonical in tshirt_designs.';
