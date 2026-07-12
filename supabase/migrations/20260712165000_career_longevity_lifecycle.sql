-- Career longevity lifecycle expansion.
-- Safe additive migration: no age changes, no forced retirement, no permanent skill loss.

alter table public.profiles
  add column if not exists career_start_date date,
  add column if not exists career_stage text not null default 'emerging' check (career_stage in ('emerging','developing','established','veteran','legacy')),
  add column if not exists career_experience_score integer not null default 0 check (career_experience_score between 0 and 100),
  add column if not exists career_resilience_state text not null default 'stable' check (career_resilience_state in ('fragile','recovering','stable','resilient','highly_resilient')),
  add column if not exists career_mode text not null default 'full_time_performer' check (career_mode in ('full_time_performer','selective_touring','studio_focused','festival_focused','local_performer','session_musician','songwriter_focused','mentor_educator','semi_retired','retired')),
  add column if not exists retirement_state text not null default 'active' check (retirement_state in ('active','selective','semi_retired','retired_from_touring','retired_from_performance','fully_retired','returning')),
  add column if not exists retirement_scope text[] not null default '{}',
  add column if not exists legacy_score integer not null default 0 check (legacy_score between 0 and 100),
  add column if not exists legacy_state text not null default 'recognised' check (legacy_state in ('recognised','respected','influential','iconic','legendary')),
  add column if not exists mentor_reputation integer not null default 0 check (mentor_reputation between 0 and 100),
  add column if not exists lifecycle_processed_on date;

update public.profiles
set career_start_date = coalesce(career_start_date, created_at::date),
    career_stage = coalesce(career_stage, 'emerging'),
    career_resilience_state = coalesce(career_resilience_state, 'stable'),
    career_mode = coalesce(career_mode, 'full_time_performer'),
    retirement_state = coalesce(retirement_state, 'active')
where career_start_date is null or career_stage is null or career_resilience_state is null;

create table if not exists public.career_wear_summaries (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  user_id uuid not null,
  cumulative_tour_load numeric not null default 0,
  cumulative_performance_load numeric not null default 0,
  cumulative_recording_load numeric not null default 0,
  cumulative_rehearsal_load numeric not null default 0,
  cumulative_travel_load numeric not null default 0,
  cumulative_burnout_exposure numeric not null default 0,
  cumulative_condition_days integer not null default 0,
  cumulative_recovery_days integer not null default 0,
  active_wear_impact integer not null default 0 check (active_wear_impact between 0 and 100),
  long_term_workload_balance integer not null default 100 check (long_term_workload_balance between 0 and 100),
  last_aggregate_month date,
  processed_keys jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.career_wear_summaries (profile_id, user_id)
select id, user_id from public.profiles
on conflict (profile_id) do nothing;

create table if not exists public.career_lifecycle_history (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null,
  event_type text not null check (event_type in ('career_start','career_stage_change','first_major_gig','first_tour','major_award','veteran_stage','retirement','farewell_event','comeback','mentoring_milestone','legacy_stage','band_reunion','career_mode_change')),
  visibility text not null default 'private' check (visibility in ('private','band','friends','public')),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  unique(profile_id, event_type, idempotency_key)
);

create table if not exists public.retirement_transitions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null,
  from_state text not null,
  to_state text not null,
  scope text[] not null default '{}',
  announcement text not null default 'private' check (announcement in ('private','band_only','friends_only','public','farewell_tour','indefinite_hiatus','temporary_retirement','no_comment')),
  conflict_summary jsonb not null default '{}'::jsonb,
  effective_at timestamptz not null default now(),
  ended_at timestamptz,
  idempotency_key text not null,
  unique(profile_id, idempotency_key)
);

create table if not exists public.comeback_plans (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null,
  comeback_type text not null check (comeback_type in ('one_off','festival','reunion_gig','new_release','short_tour','full_return','role_transition')),
  readiness_state text not null default 'significant_preparation_required' check (readiness_state in ('ready','ready_with_preparation','gradual_return_advised','significant_preparation_required','not_ready_for_demanding_return')),
  preparation_plan jsonb not null default '{}'::jsonb,
  reward_applied_at timestamptz,
  status text not null default 'draft' check (status in ('draft','active','completed','cancelled')),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique(profile_id, idempotency_key)
);

create table if not exists public.mentoring_agreements (
  id uuid primary key default gen_random_uuid(),
  mentor_profile_id uuid not null references public.profiles(id) on delete cascade,
  mentee_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_by_user_id uuid not null,
  focus text not null,
  agreement_type text not null default 'informal' check (agreement_type in ('informal','paid','band_provided','company_sponsored','time_limited','long_term')),
  status text not null default 'requested' check (status in ('requested','accepted','rejected','active','completed','cancelled')),
  frequency text not null default 'weekly',
  starts_at timestamptz,
  ends_at timestamptz,
  cost_cents integer not null default 0 check (cost_cents >= 0),
  mentor_consented_at timestamptz,
  mentee_consented_at timestamptz,
  progress jsonb not null default '{}'::jsonb,
  caps jsonb not null default '{"daily":2,"weekly_pair":3}'::jsonb,
  created_at timestamptz not null default now(),
  check (mentor_profile_id <> mentee_profile_id)
);

create table if not exists public.mentoring_sessions (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.mentoring_agreements(id) on delete cascade,
  scheduled_activity_id uuid,
  mentor_attended boolean not null default false,
  mentee_attended boolean not null default false,
  completed_at timestamptz,
  rewards_applied_at timestamptz,
  outcome jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  unique(agreement_id, idempotency_key)
);

create index if not exists idx_career_lifecycle_public on public.career_lifecycle_history(profile_id, visibility, occurred_at desc);
create index if not exists idx_mentoring_mentor on public.mentoring_agreements(mentor_profile_id, status);
create index if not exists idx_mentoring_mentee on public.mentoring_agreements(mentee_profile_id, status);

create or replace function public.resolve_career_stage(_active_years numeric, _experience integer, _activity_count integer)
returns text language sql immutable as $$
  select case when coalesce(_active_years,0) >= 15 and coalesce(_experience,0) >= 84 and coalesce(_activity_count,0) >= 260 then 'legacy'
              when coalesce(_active_years,0) >= 8 and coalesce(_experience,0) >= 62 and coalesce(_activity_count,0) >= 120 then 'veteran'
              when coalesce(_active_years,0) >= 3 and coalesce(_experience,0) >= 38 and coalesce(_activity_count,0) >= 45 then 'established'
              when coalesce(_active_years,0) >= 1 or coalesce(_experience,0) >= 18 or coalesce(_activity_count,0) >= 12 then 'developing'
              else 'emerging' end;
$$;

create or replace function public.preview_retirement_conflicts(_profile_id uuid)
returns jsonb language sql security definer set search_path = public as $$
  select case when exists (select 1 from public.profiles p where p.id = _profile_id and p.user_id = auth.uid())
    then jsonb_build_object('contracts', 0, 'band_commitments', 0, 'tours', 0, 'recording_bookings', 0, 'employment_obligations', 0, 'company_responsibilities', 0, 'upcoming_gigs', 0, 'requires_resolution', false)
    else jsonb_build_object('error', 'not_authorized') end;
$$;

create or replace function public.update_career_mode(_profile_id uuid, _mode text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = _profile_id and user_id = auth.uid()) then
    raise exception 'not authorized';
  end if;
  if _mode not in ('full_time_performer','selective_touring','studio_focused','festival_focused','local_performer','session_musician','songwriter_focused','mentor_educator','semi_retired','retired') then
    raise exception 'invalid career mode';
  end if;
  update public.profiles set career_mode = _mode where id = _profile_id;
end;
$$;

alter table public.career_wear_summaries enable row level security;
alter table public.career_lifecycle_history enable row level security;
alter table public.retirement_transitions enable row level security;
alter table public.comeback_plans enable row level security;
alter table public.mentoring_agreements enable row level security;
alter table public.mentoring_sessions enable row level security;

do $$ begin
  create policy "career wear owner read" on public.career_wear_summaries for select using (user_id = auth.uid());
  create policy "career lifecycle owner read" on public.career_lifecycle_history for select using (user_id = auth.uid() or visibility = 'public');
  create policy "retirement owner read" on public.retirement_transitions for select using (user_id = auth.uid());
  create policy "comeback owner manage" on public.comeback_plans for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  create policy "mentoring participants read" on public.mentoring_agreements for select using (exists (select 1 from public.profiles p where (p.id = mentor_profile_id or p.id = mentee_profile_id) and p.user_id = auth.uid()));
  create policy "mentoring requester insert" on public.mentoring_agreements for insert with check (created_by_user_id = auth.uid());
  create policy "mentoring sessions participants read" on public.mentoring_sessions for select using (exists (select 1 from public.mentoring_agreements a join public.profiles p on (p.id = a.mentor_profile_id or p.id = a.mentee_profile_id) where a.id = agreement_id and p.user_id = auth.uid()));
exception when duplicate_object then null; end $$;
