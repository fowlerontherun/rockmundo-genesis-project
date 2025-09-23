set check_function_bodies = off;

create table if not exists public.player_health_metrics (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  health_score integer not null default 100 check (health_score between 0 and 100),
  stress_level integer not null default 25 check (stress_level between 0 and 100),
  fitness_level integer not null default 60 check (fitness_level between 0 and 100),
  recovery_level integer not null default 60 check (recovery_level between 0 and 100),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint player_health_metrics_profile_unique unique (profile_id)
);

comment on table public.player_health_metrics is 'Snapshot of a profile\'s overall wellness metrics such as health, stress, and recovery.';
comment on column public.player_health_metrics.health_score is 'Overall health score for the profile scaled between 0-100.';
comment on column public.player_health_metrics.stress_level is 'Recorded stress level scaled between 0-100 where higher numbers are more stressed.';
comment on column public.player_health_metrics.fitness_level is 'Fitness conditioning score scaled between 0-100.';
comment on column public.player_health_metrics.recovery_level is 'Recovery readiness score scaled between 0-100.';

create index if not exists player_health_metrics_profile_id_idx on public.player_health_metrics (profile_id);
create index if not exists player_health_metrics_user_id_idx on public.player_health_metrics (user_id);

alter table public.player_health_metrics enable row level security;

create policy if not exists "Users manage their health metrics"
  on public.player_health_metrics
  for all
  using (
    auth.role() in ('service_role', 'supabase_admin')
    or user_id = auth.uid()
  )
  with check (
    auth.role() in ('service_role', 'supabase_admin')
    or user_id = auth.uid()
  );

create table if not exists public.player_health_conditions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  condition_name text not null,
  severity text not null default 'mild',
  description text,
  is_active boolean not null default true,
  detected_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.player_health_conditions is 'Tracked illnesses or medical conditions impacting a profile.';
comment on column public.player_health_conditions.severity is 'Free-form severity label such as mild, moderate, or severe.';

create index if not exists player_health_conditions_profile_id_idx on public.player_health_conditions (profile_id);
create index if not exists player_health_conditions_active_idx on public.player_health_conditions (profile_id, is_active);

alter table public.player_health_conditions enable row level security;

create policy if not exists "Users manage their health conditions"
  on public.player_health_conditions
  for all
  using (
    auth.role() in ('service_role', 'supabase_admin')
    or user_id = auth.uid()
  )
  with check (
    auth.role() in ('service_role', 'supabase_admin')
    or user_id = auth.uid()
  );

create table if not exists public.player_health_habits (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_name text not null,
  impact text default 'neutral',
  recommendation text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.player_health_habits is 'Recovery habits, addictions, and routines linked to the profile.';
comment on column public.player_health_habits.impact is 'Narrative description of how the habit affects the profile.';

create index if not exists player_health_habits_profile_id_idx on public.player_health_habits (profile_id);
create index if not exists player_health_habits_active_idx on public.player_health_habits (profile_id, is_active);

alter table public.player_health_habits enable row level security;

create policy if not exists "Users manage their health habits"
  on public.player_health_habits
  for all
  using (
    auth.role() in ('service_role', 'supabase_admin')
    or user_id = auth.uid()
  )
  with check (
    auth.role() in ('service_role', 'supabase_admin')
    or user_id = auth.uid()
  );

create table if not exists public.player_wellness_recommendations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  recommendation text not null,
  category text default 'general',
  priority text default 'normal',
  is_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

comment on table public.player_wellness_recommendations is 'Personalised wellness actions and planning prompts for the profile.';
comment on column public.player_wellness_recommendations.priority is 'Relative urgency for the recommendation such as normal or high.';

create index if not exists player_wellness_recommendations_profile_idx on public.player_wellness_recommendations (profile_id);
create index if not exists player_wellness_recommendations_completed_idx on public.player_wellness_recommendations (profile_id, is_completed);

alter table public.player_wellness_recommendations enable row level security;

create policy if not exists "Users manage their wellness recommendations"
  on public.player_wellness_recommendations
  for all
  using (
    auth.role() in ('service_role', 'supabase_admin')
    or user_id = auth.uid()
  )
  with check (
    auth.role() in ('service_role', 'supabase_admin')
    or user_id = auth.uid()
  );

-- Keep updated_at columns in sync
create trigger player_health_metrics_set_updated_at
  before update on public.player_health_metrics
  for each row
  execute function public.update_updated_at_column();

create trigger player_health_conditions_set_updated_at
  before update on public.player_health_conditions
  for each row
  execute function public.update_updated_at_column();

create trigger player_health_habits_set_updated_at
  before update on public.player_health_habits
  for each row
  execute function public.update_updated_at_column();

create trigger player_wellness_recommendations_set_updated_at
  before update on public.player_wellness_recommendations
  for each row
  execute function public.update_updated_at_column();

-- Ensure every existing profile is seeded with a health metrics record
insert into public.player_health_metrics (profile_id, user_id, health_score, stress_level, fitness_level, recovery_level)
select
  p.id,
  p.user_id,
  coalesce(p.health, 100),
  25,
  60,
  60
from public.profiles p
where not exists (
  select 1
  from public.player_health_metrics phm
  where phm.profile_id = p.id
);

-- Helper function to keep health metrics in sync for new profiles
create or replace function public.ensure_player_health_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.player_health_metrics (
    profile_id,
    user_id,
    health_score,
    stress_level,
    fitness_level,
    recovery_level
  )
  values (
    new.id,
    new.user_id,
    coalesce(new.health, 100),
    25,
    60,
    60
  )
  on conflict (profile_id) do nothing;

  return new;
end;
$$;

drop trigger if exists profiles_ensure_health_state on public.profiles;
create trigger profiles_ensure_health_state
  after insert on public.profiles
  for each row
  execute function public.ensure_player_health_state();

create or replace function public.sync_player_health_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.player_health_metrics
  set
    health_score = greatest(0, least(100, coalesce(new.health, 100))),
    updated_at = timezone('utc', now())
  where profile_id = new.id;

  return new;
end;
$$;

drop trigger if exists profiles_sync_health_score on public.profiles;
create trigger profiles_sync_health_score
  after update of health on public.profiles
  for each row
  when (old.health is distinct from new.health)
  execute function public.sync_player_health_score();

-- Reassert health defaults on profiles table
alter table public.profiles
  alter column health set default 100,
  alter column health set not null;

-- Ensure health stays within the expected bounds
alter table public.profiles
  drop constraint if exists profiles_health_check;
alter table public.profiles
  add constraint profiles_health_check check (health between 0 and 100);
