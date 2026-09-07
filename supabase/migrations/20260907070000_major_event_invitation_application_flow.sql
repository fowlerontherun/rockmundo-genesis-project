-- Major Events: real invitations plus an application fallback.
-- Applied directly to the production Supabase project on 2026-09-07; this file keeps repo schema history in sync.

alter table public.major_events
  add column if not exists max_band_slots integer not null default 12,
  add column if not exists direct_invite_slots integer not null default 6,
  add column if not exists application_fame_ratio numeric not null default 0.75;

alter table public.major_events drop constraint if exists major_events_max_band_slots_check;
alter table public.major_events add constraint major_events_max_band_slots_check check (max_band_slots between 1 and 50);
alter table public.major_events drop constraint if exists major_events_direct_invite_slots_check;
alter table public.major_events add constraint major_events_direct_invite_slots_check check (direct_invite_slots between 0 and max_band_slots);
alter table public.major_events drop constraint if exists major_events_application_fame_ratio_check;
alter table public.major_events add constraint major_events_application_fame_ratio_check check (application_fame_ratio between 0 and 1);

create table if not exists public.major_event_applications (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.major_event_instances(id) on delete cascade,
  band_id uuid not null references public.bands(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','withdrawn')),
  decision_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(instance_id, band_id)
);

create index if not exists major_event_applications_band_idx on public.major_event_applications(band_id, created_at desc);
create index if not exists major_event_applications_instance_idx on public.major_event_applications(instance_id, status);
alter table public.major_event_applications enable row level security;

drop policy if exists "Band members view major event applications" on public.major_event_applications;
create policy "Band members view major event applications"
on public.major_event_applications for select to authenticated
using (
  exists (
    select 1 from public.band_members bm
    join public.profiles p on p.id = bm.profile_id
    where bm.band_id = major_event_applications.band_id
      and p.user_id = (select auth.uid())
  )
);

create or replace function public.refresh_major_event_invites(p_instance_id uuid)
returns uuid[]
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_event public.major_events%rowtype;
  v_invites uuid[] := '{}';
begin
  select me.* into v_event
  from public.major_event_instances mei
  join public.major_events me on me.id = mei.event_id
  where mei.id = p_instance_id;

  if not found then return v_invites; end if;

  select coalesce(array_agg(x.id order by x.fame desc, x.id), '{}')
  into v_invites
  from (
    select b.id, coalesce(b.fame, 0) as fame
    from public.bands b
    where b.status::text = 'active'
      and coalesce(b.fame, 0) >= coalesce(v_event.min_fame_required, 0)
      and (v_event.genre is null or coalesce(b.primary_genre, b.genre) = v_event.genre)
    order by coalesce(b.fame, 0) desc, b.id
    limit greatest(coalesce(v_event.direct_invite_slots, 6), 0)
  ) x;

  update public.major_event_instances
  set invited_band_ids = v_invites
  where id = p_instance_id;

  return v_invites;
end;
$$;

create or replace function public.populate_major_event_invites_on_instance()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.refresh_major_event_invites(new.id);
  return new;
end;
$$;

drop trigger if exists trg_populate_major_event_invites on public.major_event_instances;
create trigger trg_populate_major_event_invites
after insert on public.major_event_instances
for each row execute function public.populate_major_event_invites_on_instance();

create or replace function public.submit_major_event_application(
  p_instance_id uuid,
  p_band_id uuid,
  p_profile_id uuid
)
returns public.major_event_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_instance public.major_event_instances%rowtype;
  v_event public.major_events%rowtype;
  v_band public.bands%rowtype;
  v_existing public.major_event_applications%rowtype;
  v_status text;
  v_reason text;
  v_taken integer;
  v_year_count integer;
  v_last_year integer;
  v_row public.major_event_applications%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles p where p.id = p_profile_id and p.user_id = v_uid) then
    raise exception 'Profile does not belong to the signed-in account';
  end if;
  if not exists (select 1 from public.band_members bm where bm.band_id = p_band_id and bm.profile_id = p_profile_id) then
    raise exception 'You are not a member of this band';
  end if;

  select * into v_instance from public.major_event_instances where id = p_instance_id;
  if not found or v_instance.status <> 'upcoming' then raise exception 'This event is not open for applications'; end if;
  if v_instance.event_start is not null and v_instance.event_start <= now() then raise exception 'This event has already started'; end if;

  select * into v_event from public.major_events where id = v_instance.event_id and is_active = true;
  if not found then raise exception 'This event is unavailable'; end if;
  select * into v_band from public.bands where id = p_band_id and status::text = 'active';
  if not found then raise exception 'Band is not active'; end if;

  select * into v_existing from public.major_event_applications where instance_id = p_instance_id and band_id = p_band_id;
  if found and v_existing.status <> 'withdrawn' then return v_existing; end if;
  if p_band_id = any(coalesce(v_instance.invited_band_ids, '{}'::uuid[])) then raise exception 'Your band already has a direct invitation'; end if;
  if v_event.genre is not null and coalesce(v_band.primary_genre, v_band.genre) is distinct from v_event.genre then raise exception 'Band genre does not match this event'; end if;
  if coalesce(v_band.fame, 0) < ceil(coalesce(v_event.min_fame_required, 0) * coalesce(v_event.application_fame_ratio, 0.75)) then raise exception 'Band fame is below the application threshold'; end if;

  select count(*) into v_year_count
  from public.major_event_performances mep
  join public.major_event_instances mei on mei.id = mep.instance_id
  where mep.band_id = p_band_id and mei.year = v_instance.year and mep.status in ('accepted','in_progress','completed');
  if v_year_count >= 2 then raise exception 'Band already has two major events in this game year'; end if;

  select max(mei.year) into v_last_year
  from public.major_event_performances mep
  join public.major_event_instances mei on mei.id = mep.instance_id
  where mep.band_id = p_band_id and mei.event_id = v_instance.event_id and mep.status = 'completed';
  if v_last_year is not null and v_instance.year - v_last_year < coalesce(v_event.cooldown_years, 3) then raise exception 'Band is still on cooldown for this event'; end if;

  select count(distinct band_id) into v_taken from (
    select unnest(coalesce(v_instance.invited_band_ids, '{}'::uuid[])) as band_id
    union select band_id from public.major_event_applications where instance_id = p_instance_id and status = 'accepted'
    union select band_id from public.major_event_performances where instance_id = p_instance_id and status in ('accepted','in_progress','completed')
  ) s;

  if v_taken < coalesce(v_event.max_band_slots, 12) then
    v_status := 'accepted';
    v_reason := 'Application accepted — an open performance slot was available.';
  else
    v_status := 'rejected';
    v_reason := 'Event lineup is currently full.';
  end if;

  insert into public.major_event_applications(instance_id, band_id, profile_id, status, decision_reason, updated_at)
  values (p_instance_id, p_band_id, p_profile_id, v_status, v_reason, now())
  on conflict(instance_id, band_id) do update set
    profile_id = excluded.profile_id,
    status = excluded.status,
    decision_reason = excluded.decision_reason,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.submit_major_event_application(uuid, uuid, uuid) from public, anon;
grant execute on function public.submit_major_event_application(uuid, uuid, uuid) to authenticated;

create or replace function public.can_accept_major_event(p_instance_id uuid, p_band_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.major_event_instances mei
    where mei.id = p_instance_id
      and mei.status = 'upcoming'
      and (mei.event_start is null or mei.event_start > now())
      and (
        p_band_id = any(coalesce(mei.invited_band_ids, '{}'::uuid[]))
        or exists (
          select 1 from public.major_event_applications mea
          where mea.instance_id = mei.id and mea.band_id = p_band_id and mea.status = 'accepted'
        )
      )
  );
$$;

alter table public.major_event_performances drop constraint if exists major_event_performances_instance_band_unique;
alter table public.major_event_performances add constraint major_event_performances_instance_band_unique unique(instance_id, band_id);

drop policy if exists "Players insert own major event performances" on public.major_event_performances;
create policy "Players insert eligible major event performances"
on public.major_event_performances for insert to authenticated
with check (
  ((user_id = (select auth.uid())) or user_id in (select p.id from public.profiles p where p.user_id = (select auth.uid())))
  and exists (
    select 1 from public.band_members bm
    join public.profiles p on p.id = bm.profile_id
    where bm.band_id = major_event_performances.band_id and p.user_id = (select auth.uid())
  )
  and public.can_accept_major_event(instance_id, band_id)
);

do $$
declare r record;
begin
  for r in select id from public.major_event_instances where status = 'upcoming' loop
    perform public.refresh_major_event_invites(r.id);
  end loop;
end $$;
