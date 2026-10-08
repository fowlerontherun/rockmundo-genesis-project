-- Player-facing progression analytics foundations.
-- This migration adds compact, permission-aware storage for snapshots,
-- recommendation state, export audits and telemetry. It intentionally keeps
-- hidden formulas, raw random seeds and exact peer data out of player-visible rows.

create table if not exists public.player_progression_snapshots (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  snapshot_date date not null,
  total_unlocked_skills integer not null default 0 check (total_unlocked_skills >= 0),
  total_skill_levels integer not null default 0 check (total_skill_levels >= 0),
  role_readiness jsonb not null default '{}'::jsonb,
  attribute_summary jsonb not null default '{}'::jsonb,
  mastery_summary jsonb not null default '{}'::jsonb,
  sharpness_summary jsonb not null default '{}'::jsonb,
  balance_version text not null default 'unknown',
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (profile_id, snapshot_date)
);

create index if not exists idx_player_progression_snapshots_profile_date
  on public.player_progression_snapshots (profile_id, snapshot_date desc);

create table if not exists public.player_analytics_recommendation_states (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  recommendation_key text not null,
  state text not null check (state in ('dismissed', 'snoozed', 'not_relevant', 'acted')),
  evidence_fingerprint text,
  snoozed_until timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (profile_id, recommendation_key)
);

create index if not exists idx_player_analytics_recommendation_states_profile
  on public.player_analytics_recommendation_states (profile_id, updated_at desc);

create table if not exists public.player_analytics_exports (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid not null default auth.uid(),
  range_key text not null check (range_key in ('7d', '30d', '90d', '6m', '1y', 'career')),
  export_format text not null check (export_format in ('csv', 'json')),
  started_at timestamptz not null default timezone('utc'::text, now()),
  completed_at timestamptz,
  status text not null default 'requested' check (status in ('requested', 'completed', 'failed', 'rate_limited')),
  row_count integer not null default 0 check (row_count >= 0)
);

create index if not exists idx_player_analytics_exports_profile_started
  on public.player_analytics_exports (profile_id, started_at desc);

create table if not exists public.player_analytics_telemetry (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  viewer_id uuid default auth.uid(),
  event_key text not null check (event_key in (
    'analytics_page_opened', 'time_range_changed', 'chart_viewed', 'comparison_used',
    'recommendation_acted', 'recommendation_dismissed', 'history_item_opened',
    'export_requested', 'band_analytics_viewed', 'personal_best_viewed'
  )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_player_analytics_telemetry_profile_created
  on public.player_analytics_telemetry (profile_id, created_at desc);

alter table public.player_progression_snapshots enable row level security;
alter table public.player_analytics_recommendation_states enable row level security;
alter table public.player_analytics_exports enable row level security;
alter table public.player_analytics_telemetry enable row level security;

drop policy if exists "Players can read own progression snapshots" on public.player_progression_snapshots;
create policy "Players can read own progression snapshots"
  on public.player_progression_snapshots for select
  using (exists (select 1 from public.profiles p where p.id = player_progression_snapshots.profile_id and p.user_id = auth.uid()));

drop policy if exists "Players can read own recommendation state" on public.player_analytics_recommendation_states;
create policy "Players can read own recommendation state"
  on public.player_analytics_recommendation_states for select
  using (exists (select 1 from public.profiles p where p.id = player_analytics_recommendation_states.profile_id and p.user_id = auth.uid()));

drop policy if exists "Players can manage own recommendation state" on public.player_analytics_recommendation_states;
create policy "Players can manage own recommendation state"
  on public.player_analytics_recommendation_states for all
  using (exists (select 1 from public.profiles p where p.id = player_analytics_recommendation_states.profile_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.profiles p where p.id = player_analytics_recommendation_states.profile_id and p.user_id = auth.uid()));

drop policy if exists "Players can read own export audits" on public.player_analytics_exports;
create policy "Players can read own export audits"
  on public.player_analytics_exports for select
  using (exists (select 1 from public.profiles p where p.id = player_analytics_exports.profile_id and p.user_id = auth.uid()));

drop policy if exists "Players can create own export audits" on public.player_analytics_exports;
create policy "Players can create own export audits"
  on public.player_analytics_exports for insert
  with check (requested_by = auth.uid() and exists (select 1 from public.profiles p where p.id = player_analytics_exports.profile_id and p.user_id = auth.uid()));

drop policy if exists "Players can create own analytics telemetry" on public.player_analytics_telemetry;
create policy "Players can create own analytics telemetry"
  on public.player_analytics_telemetry for insert
  with check ((profile_id is null or exists (select 1 from public.profiles p where p.id = player_analytics_telemetry.profile_id and p.user_id = auth.uid())) and (viewer_id is null or viewer_id = auth.uid()));

create or replace function public.get_player_progression_summary(p_profile_id uuid, p_range text default '30d')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start date;
  v_result jsonb;
begin
  if p_range not in ('7d', '30d', '90d', '6m', '1y', 'career') then
    raise exception 'Unsupported analytics range: %', p_range using errcode = '22023';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_profile_id and p.user_id = auth.uid()) then
    raise exception 'Not authorised to view analytics for this profile' using errcode = '42501';
  end if;

  v_start := case p_range
    when '7d' then (timezone('utc'::text, now())::date - 7)
    when '30d' then (timezone('utc'::text, now())::date - 30)
    when '90d' then (timezone('utc'::text, now())::date - 90)
    when '6m' then (timezone('utc'::text, now())::date - 183)
    when '1y' then (timezone('utc'::text, now())::date - 365)
    else null
  end;

  select jsonb_build_object(
    'profile_id', p_profile_id,
    'range', p_range,
    'generated_at', timezone('utc'::text, now()),
    'snapshots', coalesce(jsonb_agg(to_jsonb(s) order by s.snapshot_date), '[]'::jsonb),
    'uses_aggregates', p_range in ('6m', '1y', 'career')
  ) into v_result
  from public.player_progression_snapshots s
  where s.profile_id = p_profile_id
    and (v_start is null or s.snapshot_date >= v_start);

  return coalesce(v_result, jsonb_build_object('profile_id', p_profile_id, 'range', p_range, 'snapshots', '[]'::jsonb));
end;
$$;

create or replace function public.get_player_role_trend(p_profile_id uuid, p_role_key text, p_range text default '30d')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_summary jsonb;
begin
  v_summary := public.get_player_progression_summary(p_profile_id, p_range);
  return jsonb_build_object(
    'profile_id', p_profile_id,
    'role_key', p_role_key,
    'range', p_range,
    'observations', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'snapshot_date', s.snapshot_date,
        'readiness', s.role_readiness -> p_role_key,
        'balance_version', s.balance_version
      ) order by s.snapshot_date), '[]'::jsonb)
      from public.player_progression_snapshots s
      where s.profile_id = p_profile_id
        and s.role_readiness ? p_role_key
    ),
    'version_warning', exists (
      select 1
      from public.player_progression_snapshots s
      where s.profile_id = p_profile_id
      group by s.profile_id
      having count(distinct s.balance_version) > 1
    )
  );
end;
$$;

comment on table public.player_progression_snapshots is 'Compact daily/event player progression snapshots for trend analytics. Stores summaries only, not hidden formula inputs or raw private event streams.';
comment on function public.get_player_progression_summary(uuid, text) is 'Authorised player progression summary over bounded supported ranges; clients must not fetch unbounded raw lifetime events for analytics.';
comment on function public.get_player_role_trend(uuid, text, text) is 'Authorised role-readiness observations derived from progression snapshots.';
