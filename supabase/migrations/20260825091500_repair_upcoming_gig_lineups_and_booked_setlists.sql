-- Repair Upcoming Gigs > View Details runtime drift.
--
-- Production had the newer gig preparation UI but was missing gig_performers,
-- while gigs booked through the legacy booking flow only populated gigs.setlist_id.
-- This migration restores lineup rows and mirrors the booked setlist into the
-- authoritative gig_setlists/gig_setlist_items preparation model.

create table if not exists public.gig_performers (
  id uuid primary key default gen_random_uuid(),
  gig_id uuid not null references public.gigs(id) on delete cascade,
  band_id uuid not null references public.bands(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  role_or_instrument text,
  lineup_status text not null default 'selected' check (lineup_status in ('selected','performed','missed')),
  selected_at timestamptz not null default now(),
  performed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gig_performers_unique unique (gig_id, profile_id)
);

create index if not exists gig_performers_gig_idx
  on public.gig_performers (gig_id, lineup_status);
create index if not exists gig_performers_band_profile_idx
  on public.gig_performers (band_id, profile_id);

alter table public.gig_performers enable row level security;

drop policy if exists "Active band members can view gig performers" on public.gig_performers;
create policy "Active band members can view gig performers"
on public.gig_performers for select to authenticated
using (
  exists (
    select 1
    from public.band_members bm
    where bm.band_id = gig_performers.band_id
      and (bm.user_id = auth.uid() or bm.profile_id = auth.uid())
      and coalesce(bm.member_status, 'active') = 'active'
  )
);

create or replace function public.seed_gig_performers(p_gig_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gig public.gigs%rowtype;
  v_count integer := 0;
begin
  select * into v_gig from public.gigs where id = p_gig_id;
  if not found or coalesce(v_gig.status, '') in ('cancelled','failed') then
    return 0;
  end if;

  insert into public.gig_performers (
    gig_id, band_id, profile_id, role_or_instrument, lineup_status, selected_at
  )
  select
    v_gig.id,
    v_gig.band_id,
    bm.profile_id,
    nullif(coalesce(bm.instrument_role, bm.role), ''),
    'selected',
    now()
  from public.band_members bm
  where bm.band_id = v_gig.band_id
    and bm.profile_id is not null
    and coalesce(bm.member_status, 'active') = 'active'
    and coalesce(bm.is_touring_member, false) = false
    and (bm.joined_at is null or bm.joined_at <= coalesce(v_gig.scheduled_date, now()))
  on conflict on constraint gig_performers_unique do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.seed_gig_performers(uuid) to authenticated;

create or replace function public.seed_gig_performers_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_gig_performers(new.id);
  return new;
end;
$$;

drop trigger if exists seed_gig_performers_on_insert on public.gigs;
create trigger seed_gig_performers_on_insert
after insert on public.gigs
for each row execute function public.seed_gig_performers_on_insert();

create or replace function public.ensure_gig_preparation_from_booked_setlist(p_gig_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gig record;
  v_gig_setlist_id uuid;
  v_total integer := 0;
begin
  select g.id, g.setlist_id
    into v_gig
  from public.gigs g
  where g.id = p_gig_id;

  if not found or v_gig.setlist_id is null then
    return null;
  end if;

  select gs.id into v_gig_setlist_id
  from public.gig_setlists gs
  where gs.gig_id = p_gig_id
  limit 1;

  if v_gig_setlist_id is null then
    insert into public.gig_setlists (gig_id, name, status)
    values (p_gig_id, 'Booked setlist', 'ready')
    on conflict (gig_id) do update set updated_at = now()
    returning id into v_gig_setlist_id;
  end if;

  if not exists (
    select 1 from public.gig_setlist_items gsi where gsi.setlist_id = v_gig_setlist_id
  ) then
    insert into public.gig_setlist_items (setlist_id, song_id, position, is_encore)
    select
      v_gig_setlist_id,
      ss.song_id,
      ss.position,
      coalesce(ss.is_encore, false)
    from public.setlist_songs ss
    where ss.setlist_id = v_gig.setlist_id
    order by ss.position;
  end if;

  select coalesce(sum(coalesce(s.duration_seconds, 0)), 0)::integer
    into v_total
  from public.gig_setlist_items gsi
  left join public.songs s on s.id = gsi.song_id
  where gsi.setlist_id = v_gig_setlist_id;

  update public.gig_setlists
  set total_duration_seconds = v_total,
      status = case when exists (
        select 1 from public.gig_setlist_items x where x.setlist_id = v_gig_setlist_id
      ) then 'ready' else status end,
      updated_at = now()
  where id = v_gig_setlist_id;

  return v_gig_setlist_id;
end;
$$;

grant execute on function public.ensure_gig_preparation_from_booked_setlist(uuid) to authenticated;

create or replace function public.sync_booked_gig_preparation_setlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.setlist_id is not null then
    perform public.ensure_gig_preparation_from_booked_setlist(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists sync_booked_gig_preparation_setlist on public.gigs;
create trigger sync_booked_gig_preparation_setlist
after insert or update of setlist_id on public.gigs
for each row execute function public.sync_booked_gig_preparation_setlist();

do $$
declare r record;
begin
  for r in
    select id from public.gigs
    where scheduled_date > now()
      and coalesce(status, '') not in ('cancelled','completed','failed')
  loop
    perform public.seed_gig_performers(r.id);
    perform public.ensure_gig_preparation_from_booked_setlist(r.id);
  end loop;
end $$;
