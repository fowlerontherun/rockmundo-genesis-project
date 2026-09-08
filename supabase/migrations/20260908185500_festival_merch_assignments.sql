create table if not exists public.festival_merch_assignments (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid not null references public.game_events(id) on delete cascade,
  band_id uuid not null references public.bands(id) on delete cascade,
  merchandise_id uuid not null references public.player_merchandise(id) on delete cascade,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (festival_id, merchandise_id)
);

create index if not exists festival_merch_assignments_festival_idx on public.festival_merch_assignments(festival_id);
create index if not exists festival_merch_assignments_band_idx on public.festival_merch_assignments(band_id);
create index if not exists festival_merch_assignments_merch_idx on public.festival_merch_assignments(merchandise_id);

alter table public.festival_merch_assignments enable row level security;

drop policy if exists "Festival merch assignments are viewable" on public.festival_merch_assignments;
create policy "Festival merch assignments are viewable"
on public.festival_merch_assignments for select
to authenticated
using (true);

drop policy if exists "Band members add festival merch assignments" on public.festival_merch_assignments;
create policy "Band members add festival merch assignments"
on public.festival_merch_assignments for insert
to authenticated
with check (
  exists (
    select 1
    from public.band_members bm
    join public.profiles p on p.id = bm.profile_id
    where bm.band_id = festival_merch_assignments.band_id
      and p.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.player_merchandise pm
    where pm.id = festival_merch_assignments.merchandise_id
      and pm.band_id = festival_merch_assignments.band_id
  )
  and exists (
    select 1 from public.game_events ge
    where ge.id = festival_merch_assignments.festival_id
      and ge.event_type = 'festival'
  )
);

drop policy if exists "Band members remove festival merch assignments" on public.festival_merch_assignments;
create policy "Band members remove festival merch assignments"
on public.festival_merch_assignments for delete
to authenticated
using (
  exists (
    select 1
    from public.band_members bm
    join public.profiles p on p.id = bm.profile_id
    where bm.band_id = festival_merch_assignments.band_id
      and p.user_id = (select auth.uid())
  )
);

comment on table public.festival_merch_assignments is 'Links real manufactured band merchandise to festival stands without duplicating inventory.';
