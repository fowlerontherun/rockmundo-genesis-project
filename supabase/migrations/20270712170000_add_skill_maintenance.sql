-- Add fair, bounded skill maintenance metadata and audit records.
-- Existing levels, XP, mastery ranks, titles and completed outcomes are not changed.
alter table public.skill_definitions
  add column if not exists supports_maintenance boolean not null default false,
  add column if not exists maintenance_policy_key text not null default 'none',
  add column if not exists maintenance_threshold_level integer not null default 101,
  add column if not exists maintenance_grace_days integer not null default 36500,
  add column if not exists maintenance_floor numeric not null default 100,
  add column if not exists recovery_rate_key text not null default 'none';

create table if not exists public.player_skill_sharpness (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  skill_id text not null,
  sharpness numeric not null default 100 check (sharpness >= 0 and sharpness <= 100),
  last_qualified_use_at timestamptz,
  last_calculated_at timestamptz not null default now(),
  maintenance_policy_key text not null default 'none',
  balance_version text not null default 'skill-maintenance-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, skill_id)
);

create table if not exists public.skill_maintenance_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  skill_id text not null,
  specialisation_id text,
  event_type text not null check (event_type in ('qualifying_use','recovery','comeback_bonus','policy_change','admin_adjustment')),
  sharpness_before numeric not null check (sharpness_before >= 0 and sharpness_before <= 100),
  sharpness_after numeric not null check (sharpness_after >= 0 and sharpness_after <= 100),
  source_type text not null,
  source_id text not null,
  balance_version text not null default 'skill-maintenance-v1',
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (profile_id, skill_id, idempotency_key)
);

alter table public.player_skill_sharpness enable row level security;
alter table public.skill_maintenance_events enable row level security;

drop policy if exists "players can read own skill sharpness" on public.player_skill_sharpness;
create policy "players can read own skill sharpness" on public.player_skill_sharpness
  for select using (profile_id in (select id from public.profiles where user_id = auth.uid()));
drop policy if exists "players can read own maintenance events" on public.skill_maintenance_events;
create policy "players can read own maintenance events" on public.skill_maintenance_events
  for select using (profile_id in (select id from public.profiles where user_id = auth.uid()));

create index if not exists idx_player_skill_sharpness_profile on public.player_skill_sharpness(profile_id);
create index if not exists idx_skill_maintenance_events_profile_skill on public.skill_maintenance_events(profile_id, skill_id, created_at desc);

create or replace view public.admin_skill_maintenance_diagnostics as
select s.profile_id, s.skill_id, s.sharpness, s.last_qualified_use_at, s.last_calculated_at,
       s.maintenance_policy_key, s.balance_version,
       count(e.id) as maintenance_event_count,
       max(e.created_at) as last_event_at,
       count(*) filter (where e.event_type = 'qualifying_use') as qualifying_use_events
from public.player_skill_sharpness s
left join public.skill_maintenance_events e on e.profile_id = s.profile_id and e.skill_id = s.skill_id
group by s.profile_id, s.skill_id, s.sharpness, s.last_qualified_use_at, s.last_calculated_at, s.maintenance_policy_key, s.balance_version;
