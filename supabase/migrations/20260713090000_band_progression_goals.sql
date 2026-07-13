create type public.band_progression_goal_status as enum ('draft','proposed','active','blocked','completed','abandoned','archived');
create type public.band_progression_goal_type as enum ('role_coverage','recording_readiness','gig_readiness','songwriting_capability','rehearsal_readiness','genre_development','professional_skill','newcomer_onboarding','role_handover','custom_guided');
create type public.band_progression_task_status as enum ('suggested','claimed','assigned','declined','completed','blocked');

create table if not exists public.band_progression_goals (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text,
  goal_type public.band_progression_goal_type not null,
  source_type text,
  source_id uuid,
  status public.band_progression_goal_status not null default 'draft',
  created_by uuid not null references public.profiles(id),
  target_date date,
  priority smallint not null default 3 check (priority between 1 and 5),
  visibility text not null default 'band' check (visibility in ('band','leaders','private_contributors')),
  balance_version text not null default 'band-progression-v1',
  blocked_reasons jsonb not null default '[]'::jsonb,
  completed_snapshot jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.band_goal_requirements (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.band_progression_goals(id) on delete cascade,
  requirement_type text not null,
  target_key text not null,
  target_value jsonb not null default '{}'::jsonb,
  comparison text not null default 'gte' check (comparison in ('gte','lte','eq','exists','complete')),
  member_scope text not null default 'band' check (member_scope in ('band','all_active_members','assigned_member','any_member')),
  assigned_profile_id uuid references public.profiles(id),
  is_required boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.band_goal_member_tasks (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.band_progression_goals(id) on delete cascade,
  suggested_profile_id uuid references public.profiles(id),
  claimed_by uuid references public.profiles(id),
  assigned_profile_id uuid references public.profiles(id),
  title text not null,
  status public.band_progression_task_status not null default 'suggested',
  progress jsonb not null default '{}'::jsonb,
  due_date date,
  priority smallint not null default 3 check (priority between 1 and 5),
  impact_explanation text not null,
  declined_reason text,
  alternative_suggestion text,
  muted_by uuid[] not null default '{}',
  source_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (claimed_by is null or status in ('claimed','completed','blocked'))
);

create table if not exists public.band_training_plans (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  goal_id uuid references public.band_progression_goals(id) on delete set null,
  title text not null,
  status text not null default 'draft' check (status in ('draft','proposed','active','blocked','completed','abandoned','archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.band_training_plan_steps (
  id uuid primary key default gen_random_uuid(),
  training_plan_id uuid not null references public.band_training_plans(id) on delete cascade,
  step_type text not null check (step_type in ('practice','lesson','mentoring','rehearsal','jam','songwriting','recording','gig','equipment_preparation','attendance_confirmation')),
  target_profile_id uuid references public.profiles(id),
  target_skill_id text,
  source_activity_id uuid,
  target_value jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','proposed','accepted','completed','cancelled','blocked')),
  sequence integer not null default 0,
  optional boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  completed_source_event_id text,
  created_at timestamptz not null default now(),
  unique(training_plan_id, completed_source_event_id)
);

create table if not exists public.band_progression_rewards (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.band_progression_goals(id) on delete restrict,
  band_id uuid not null references public.bands(id) on delete cascade,
  reward_type text not null check (reward_type in ('cohesion','reputation','badge','morale','preparation_friction','treasury')),
  amount numeric not null default 0 check (amount >= 0),
  idempotency_key text not null unique,
  source_event_id text not null,
  applied_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.band_progression_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.band_progression_goals(id) on delete cascade,
  profile_id uuid not null references public.profiles(id),
  contribution_type text not null,
  source_event_id text not null,
  summary text not null,
  occurred_at timestamptz not null default now(),
  unique(goal_id, profile_id, source_event_id)
);

create unique index if not exists idx_band_goal_requirement_unique_target on public.band_goal_requirements(goal_id, requirement_type, target_key, coalesce(assigned_profile_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists idx_band_progression_goals_band_status on public.band_progression_goals(band_id, status);
create index if not exists idx_band_goal_tasks_goal_status on public.band_goal_member_tasks(goal_id, status);
create index if not exists idx_band_training_plans_band_status on public.band_training_plans(band_id, status);

alter table public.band_progression_goals enable row level security;
alter table public.band_goal_requirements enable row level security;
alter table public.band_goal_member_tasks enable row level security;
alter table public.band_training_plans enable row level security;
alter table public.band_training_plan_steps enable row level security;
alter table public.band_progression_rewards enable row level security;
alter table public.band_progression_contributions enable row level security;

create policy "active band members can view band progression goals" on public.band_progression_goals for select using (public.is_active_band_member(band_id, auth.uid()));
create policy "active band members can create draft goals" on public.band_progression_goals for insert with check (public.is_active_band_member(band_id, auth.uid()) and created_by in (select id from public.profiles where user_id = auth.uid()) and status in ('draft','proposed'));
create policy "band leaders can update non-completed goals" on public.band_progression_goals for update using (status not in ('completed','archived') and exists (select 1 from public.band_members bm where bm.band_id = band_progression_goals.band_id and bm.user_id = auth.uid() and bm.member_status = 'active' and lower(coalesce(bm.role,'')) in ('leader','founder','co-leader','manager'))) with check (status not in ('completed','archived'));

create policy "active members can view goal requirements" on public.band_goal_requirements for select using (exists (select 1 from public.band_progression_goals g where g.id = goal_id and public.is_active_band_member(g.band_id, auth.uid())));
create policy "active members can view goal tasks" on public.band_goal_member_tasks for select using (exists (select 1 from public.band_progression_goals g where g.id = goal_id and public.is_active_band_member(g.band_id, auth.uid())));
create policy "members can claim or decline own tasks" on public.band_goal_member_tasks for update using (exists (select 1 from public.band_progression_goals g join public.profiles p on p.user_id = auth.uid() where g.id = goal_id and public.is_active_band_member(g.band_id, auth.uid()) and (claimed_by = p.id or suggested_profile_id = p.id or assigned_profile_id = p.id))) with check (status in ('claimed','declined','blocked'));
create policy "active members can view training plans" on public.band_training_plans for select using (public.is_active_band_member(band_id, auth.uid()));
create policy "active members can view plan steps" on public.band_training_plan_steps for select using (exists (select 1 from public.band_training_plans p where p.id = training_plan_id and public.is_active_band_member(p.band_id, auth.uid())));
create policy "active members can view rewards" on public.band_progression_rewards for select using (public.is_active_band_member(band_id, auth.uid()));
create policy "active members can view contributions" on public.band_progression_contributions for select using (exists (select 1 from public.band_progression_goals g where g.id = goal_id and public.is_active_band_member(g.band_id, auth.uid())));

create table if not exists public.band_progression_telemetry (
  id uuid primary key default gen_random_uuid(),
  band_id uuid references public.bands(id) on delete cascade,
  profile_id uuid references public.profiles(id),
  event_name text not null check (event_name in ('goal_suggested','goal_created','goal_activated','task_claimed','task_declined','training_plan_step_completed','role_gap_resolved','milestone_reached','goal_completed','goal_abandoned','synergy_reward_applied','onboarding_plan_completed','suspicious_repeat_pattern_detected')),
  source_type text,
  source_id uuid,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.band_progression_telemetry enable row level security;
create policy "band leaders can view progression telemetry" on public.band_progression_telemetry for select using (
  band_id is not null and exists (
    select 1 from public.band_members bm
    where bm.band_id = band_progression_telemetry.band_id
      and bm.user_id = auth.uid()
      and bm.member_status = 'active'
      and lower(coalesce(bm.role,'')) in ('leader','founder','co-leader','manager')
  )
);

create or replace view public.admin_band_progression_diagnostics as
select
  g.band_id,
  g.id as goal_id,
  g.goal_type,
  g.status,
  g.balance_version,
  g.blocked_reasons,
  count(distinct r.id) as requirement_count,
  count(distinct t.id) as task_count,
  count(distinct p.id) as training_plan_count,
  count(distinct rw.id) as reward_count,
  count(distinct c.id) as contribution_count,
  g.created_at,
  g.updated_at
from public.band_progression_goals g
left join public.band_goal_requirements r on r.goal_id = g.id
left join public.band_goal_member_tasks t on t.goal_id = g.id
left join public.band_training_plans p on p.goal_id = g.id
left join public.band_progression_rewards rw on rw.goal_id = g.id
left join public.band_progression_contributions c on c.goal_id = g.id
group by g.band_id, g.id;
