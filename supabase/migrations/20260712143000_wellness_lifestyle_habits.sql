-- Wellness lifestyle habits, routines, sleep debt, nightlife and burnout prevention.
-- Safe additive migration: existing players receive neutral defaults and missing history never penalises them.

create table if not exists public.wellness_lifestyle_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  user_id uuid not null,
  sleep_consistency integer not null default 70 check (sleep_consistency between 0 and 100),
  sleep_debt integer not null default 0 check (sleep_debt between 0 and 100),
  activity_balance integer not null default 65 check (activity_balance between 0 and 100),
  exercise_consistency integer not null default 45 check (exercise_consistency between 0 and 100),
  nutrition_consistency integer not null default 65 check (nutrition_consistency between 0 and 100),
  hydration_consistency integer not null default 65 check (hydration_consistency between 0 and 100),
  social_activity integer not null default 45 check (social_activity between 0 and 100),
  partying_frequency integer not null default 20 check (partying_frequency between 0 and 100),
  alcohol_exposure integer not null default 0 check (alcohol_exposure between 0 and 100),
  recovery_discipline integer not null default 60 check (recovery_discipline between 0 and 100),
  workload_intensity integer not null default 35 check (workload_intensity between 0 and 100),
  downtime_quality integer not null default 55 check (downtime_quality between 0 and 100),
  routine_stability integer not null default 55 check (routine_stability between 0 and 100),
  burnout_pressure integer not null default 18 check (burnout_pressure between 0 and 100),
  lifestyle_balance integer not null default 65 check (lifestyle_balance between 0 and 100),
  lifestyle_state text not null default 'Balanced' check (lifestyle_state in ('Highly balanced','Balanced','Busy','Unstable','Exhausting','Unsustainable')),
  burnout_stage text not null default 'Low pressure' check (burnout_stage in ('Low pressure','Building pressure','High pressure','Burnout warning','Mild burnout','Severe burnout')),
  lifestyle_identity text not null default 'Balanced performer',
  lifestyle_reputation text not null default 'Professional' check (lifestyle_reputation in ('Professional','Sociable','Party regular','Wild','Unreliable')),
  primary_recommendation text not null default 'Keep a sustainable mix of work, rest and social time.',
  most_important_trend text not null default 'No long-term trend yet.',
  last_processed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.wellness_lifestyle_profiles (profile_id, user_id, sleep_debt, burnout_pressure)
select id, user_id, 0, least(100, greatest(0, coalesce(burnout_risk, 18)))
from public.profiles
on conflict (profile_id) do nothing;

create table if not exists public.wellness_lifestyle_daily_aggregates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  aggregate_on date not null,
  sleep_minutes integer not null default 0,
  effective_sleep_minutes integer not null default 0,
  sleep_start_hour numeric,
  rest_minutes integer not null default 0,
  exercise_minutes integer not null default 0,
  nutrition_score integer not null default 65 check (nutrition_score between 0 and 100),
  hydration_score integer not null default 65 check (hydration_score between 0 and 100),
  social_minutes integer not null default 0,
  party_minutes integer not null default 0,
  alcohol_exposure integer not null default 0 check (alcohol_exposure between 0 and 100),
  workload_minutes integer not null default 0,
  travel_minutes integer not null default 0,
  gig_minutes integer not null default 0,
  rehearsal_minutes integer not null default 0,
  recording_minutes integer not null default 0,
  professional_support_minutes integer not null default 0,
  home_recovery_minutes integer not null default 0,
  processed_sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id, aggregate_on)
);

create table if not exists public.wellness_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  category text not null check (category in ('sleep_schedule','morning_routine','exercise_schedule','meal_plan','hydration','daily_relaxation','weekly_rest_day','social_evening','practice_limit','pre_gig','post_gig_recovery','tour_recovery')),
  mode text not null default 'manual' check (mode in ('manual','guided','assisted','managed')),
  priority text not null default 'recovery' check (priority in ('career_progression','performance_readiness','social_life','fitness','recovery','mental_wellbeing','networking','budget_control')),
  schedule_rule jsonb not null default '{}'::jsonb,
  automation_settings jsonb not null default '{}'::jsonb,
  max_weekly_budget_cents integer not null default 0 check (max_weekly_budget_cents >= 0),
  paused_at timestamptz,
  last_generated_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wellness_routine_executions (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.wellness_routines(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null,
  planned_start timestamptz not null,
  planned_end timestamptz not null,
  scheduled_activity_id uuid,
  status text not null default 'planned' check (status in ('planned','scheduled','skipped','conflict','completed','cancelled')),
  skip_reason text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique(routine_id, idempotency_key)
);

create table if not exists public.wellness_lifestyle_traits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  trait_slug text not null,
  trait_name text not null,
  progress integer not null default 0 check (progress between 0 and 100),
  active boolean not null default false,
  benefits text not null,
  tradeoffs text not null,
  behaviour_source text not null,
  last_changed_on date,
  updated_at timestamptz not null default now(),
  unique(profile_id, trait_slug)
);

create table if not exists public.wellness_social_activity_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  source_activity_id uuid,
  activity_slug text not null,
  intensity text not null default 'casual' check (intensity in ('quiet','casual','lively','heavy')),
  alcohol_free boolean not null default false,
  social_reward_count integer not null default 0 check (social_reward_count between 0 and 3),
  fame_reward_applied integer not null default 0 check (fame_reward_applied between 0 and 8),
  relationship_reward_applied integer not null default 0 check (relationship_reward_applied between 0 and 10),
  alcohol_exposure integer not null default 0 check (alcohol_exposure between 0 and 100),
  readiness_penalty integer not null default 0 check (readiness_penalty between 0 and 25),
  processed_at timestamptz not null default now(),
  idempotency_key text not null,
  unique(profile_id, idempotency_key)
);

alter table public.wellness_activity_log
  add column if not exists idempotency_key text,
  add column if not exists lifestyle_effects jsonb not null default '{}'::jsonb;

alter table public.wellness_activity_catalog
  add column if not exists lifestyle_tags text[] not null default '{}',
  add column if not exists party_intensity text check (party_intensity is null or party_intensity in ('quiet','casual','lively','heavy')),
  add column if not exists supports_alcohol_free boolean not null default false,
  add column if not exists alcohol_exposure integer not null default 0 check (alcohol_exposure between 0 and 100),
  add column if not exists social_opportunity jsonb not null default '{}'::jsonb;

insert into public.wellness_activity_catalog (slug, name, category, description, duration_minutes, cooldown_hours, stamina_cost, cost_cents, stat_effects, ailment_risk, treats_ailment_slug, unlock_min_fame, unlock_tier, can_overlap, location_tags, gameplay_impact, is_active, sort_order, lifestyle_tags, party_intensity, supports_alcohol_free, alcohol_exposure, social_opportunity)
values
('quiet_social_evening','Quiet social evening','indulgence','Low-pressure social time with friends, fans or bandmates; alcohol-free participation is fully viable.',120,8,2,0,'{"happiness":6,"stress":-5,"fatigue":2,"sleep_quality":-2}','{}',null,0,'new_artist',false,'{home,cafe,venue}','Relationship and happiness upside with minimal readiness cost.',true,210,'{social,nightlife,recovery}', 'quiet', true, 0, '{"networking_chance":8,"relationship_chance":14,"fame_chance":1}'),
('casual_drinks','Casual drinks','indulgence','A relaxed night out. Offers social hooks but can reduce hydration and sleep quality.',120,12,4,1800,'{"happiness":8,"stress":-6,"fatigue":6,"sleep_quality":-6,"motivation":2}','{"hangover":0.02}',null,0,'new_artist',false,'{bar,venue}','Bounded networking and relationship chances with next-day recovery costs.',true,220,'{social,nightlife,alcohol_optional}', 'casual', true, 12, '{"networking_chance":14,"relationship_chance":16,"fame_chance":2}'),
('club_night','Club night','indulgence','A lively late event with stronger networking chances and stronger fatigue, hydration and sleep trade-offs.',180,24,8,4500,'{"happiness":11,"stress":-7,"fatigue":12,"sleep_quality":-14,"motivation":3}','{"hangover":0.06}',null,100,'active_musician',false,'{club,venue}','Higher intensity nightlife is useful socially but weakens next-day readiness.',true,230,'{social,nightlife,alcohol_optional}', 'lively', true, 24, '{"networking_chance":22,"relationship_chance":20,"fame_chance":4}'),
('industry_party','Industry party','indulgence','A professional nightlife event with capped promoter, journalist and producer encounter chances.',180,72,8,9000,'{"happiness":12,"stress":-6,"fatigue":16,"sleep_quality":-18,"motivation":4}','{"hangover":0.08}',null,1000,'professional_artist',false,'{club,hotel,venue}','Career-adjacent social event; expensive access never guarantees progression.',true,240,'{social,nightlife,networking,alcohol_optional}', 'lively', true, 20, '{"networking_chance":28,"relationship_chance":18,"fame_chance":5}'),
('post_gig_recovery','Post-gig recovery routine','recovery','Hydrate, wind down and recover after a demanding show before nightlife spirals into burnout pressure.',90,12,0,0,'{"fatigue":-10,"sleep_quality":8,"stress":-5,"nutrition":4,"motivation":2}','{}',null,100,'active_musician',false,'{venue,hotel,home}','Useful after gigs, recording and tour travel; supports assisted routines.',true,250,'{routine,recovery,post_gig}', null, false, 0, '{}')
on conflict (slug) do update set
  name=excluded.name, description=excluded.description, duration_minutes=excluded.duration_minutes, cooldown_hours=excluded.cooldown_hours,
  stamina_cost=excluded.stamina_cost, cost_cents=excluded.cost_cents, stat_effects=excluded.stat_effects, ailment_risk=excluded.ailment_risk,
  unlock_min_fame=excluded.unlock_min_fame, unlock_tier=excluded.unlock_tier, location_tags=excluded.location_tags,
  gameplay_impact=excluded.gameplay_impact, is_active=excluded.is_active, sort_order=excluded.sort_order,
  lifestyle_tags=excluded.lifestyle_tags, party_intensity=excluded.party_intensity, supports_alcohol_free=excluded.supports_alcohol_free,
  alcohol_exposure=excluded.alcohol_exposure, social_opportunity=excluded.social_opportunity;

create or replace function public.lifestyle_burnout_stage(_pressure integer) returns text language sql immutable as $$
  select case when coalesce(_pressure,0) >= 94 then 'Severe burnout'
              when coalesce(_pressure,0) >= 82 then 'Mild burnout'
              when coalesce(_pressure,0) >= 70 then 'Burnout warning'
              when coalesce(_pressure,0) >= 55 then 'High pressure'
              when coalesce(_pressure,0) >= 38 then 'Building pressure'
              else 'Low pressure' end;
$$;

create or replace function public.lifestyle_state_from_scores(_balance integer, _burnout integer, _workload integer) returns text language sql immutable as $$
  select case when coalesce(_balance,0) >= 84 then 'Highly balanced'
              when coalesce(_balance,0) >= 68 then 'Balanced'
              when coalesce(_burnout,0) < 55 and coalesce(_workload,0) > 58 then 'Busy'
              when coalesce(_balance,0) >= 45 then 'Unstable'
              when coalesce(_burnout,0) < 82 then 'Exhausting'
              else 'Unsustainable' end;
$$;

create or replace function public.get_lifestyle_summary(_profile_id uuid)
returns table(profile_id uuid, lifestyle_state text, lifestyle_identity text, sleep_debt integer, burnout_stage text, burnout_pressure integer, lifestyle_reputation text, primary_recommendation text)
language sql security definer set search_path = public as $$
  select p.profile_id, p.lifestyle_state, p.lifestyle_identity, p.sleep_debt, p.burnout_stage, p.burnout_pressure, p.lifestyle_reputation, p.primary_recommendation
  from public.wellness_lifestyle_profiles p
  join public.profiles pr on pr.id = p.profile_id
  where p.profile_id = _profile_id and pr.user_id = auth.uid();
$$;

alter table public.wellness_lifestyle_profiles enable row level security;
alter table public.wellness_lifestyle_daily_aggregates enable row level security;
alter table public.wellness_routines enable row level security;
alter table public.wellness_routine_executions enable row level security;
alter table public.wellness_lifestyle_traits enable row level security;
alter table public.wellness_social_activity_history enable row level security;

do $$ begin
  create policy "lifestyle profile owner read" on public.wellness_lifestyle_profiles for select using (user_id = auth.uid());
  create policy "lifestyle aggregate owner read" on public.wellness_lifestyle_daily_aggregates for select using (user_id = auth.uid());
  create policy "routine owner manage" on public.wellness_routines for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  create policy "routine execution owner read" on public.wellness_routine_executions for select using (user_id = auth.uid());
  create policy "lifestyle traits owner read" on public.wellness_lifestyle_traits for select using (user_id = auth.uid());
  create policy "social lifestyle owner read" on public.wellness_social_activity_history for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
