-- Create table to track profile status sessions and ensure XP configuration tables are accessible
set check_function_bodies = off;

-- Profile status sessions capture the lifecycle of timed statuses that players start from the game client
create table if not exists public.profile_status_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null,
  metadata jsonb default '{}'::jsonb,
  started_at timestamptz default timezone('utc', now()),
  ends_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profile_status_sessions_metadata_object check (
    metadata is null or jsonb_typeof(metadata) = 'object'
  )
);

comment on table public.profile_status_sessions is 'Tracks individual active status sessions for a profile including timing metadata.';
comment on column public.profile_status_sessions.metadata is 'Optional JSON metadata describing the status session context.';
comment on column public.profile_status_sessions.ends_at is 'UTC timestamp representing when the status session is scheduled to end.';
comment on column public.profile_status_sessions.closed_at is 'UTC timestamp representing when the session was explicitly closed.';

create index if not exists profile_status_sessions_profile_id_idx
  on public.profile_status_sessions (profile_id);

create unique index if not exists profile_status_sessions_active_idx
  on public.profile_status_sessions (profile_id)
  where closed_at is null;

alter table public.profile_status_sessions enable row level security;

create policy if not exists "Users manage their status sessions"
  on public.profile_status_sessions
  for all
  using (
    auth.role() in ('service_role', 'supabase_admin')
    or exists (
      select 1
      from public.profiles p
      where p.id = profile_status_sessions.profile_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    auth.role() in ('service_role', 'supabase_admin')
    or exists (
      select 1
      from public.profiles p
      where p.id = profile_status_sessions.profile_id
        and p.user_id = auth.uid()
    )
  );

create trigger profile_status_sessions_set_updated_at
  before update on public.profile_status_sessions
  for each row
  execute function public.update_updated_at_column();

grant select, insert, update, delete on public.profile_status_sessions to authenticated;

-- Ensure the daily XP tables participate in RLS so authenticated clients can query them directly
alter table if exists public.daily_xp_settings enable row level security;

create policy if not exists "XP settings readable"
  on public.daily_xp_settings
  for select
  using (auth.role() in ('service_role', 'supabase_admin', 'authenticated', 'anon'));

grant select on public.daily_xp_settings to authenticated;
grant select on public.daily_xp_settings to anon;

alter table if exists public.profile_daily_xp_grants enable row level security;

create policy if not exists "Users read their daily XP grants"
  on public.profile_daily_xp_grants
  for select
  using (
    auth.role() in ('service_role', 'supabase_admin')
    or exists (
      select 1
      from public.profiles p
      where p.id = profile_daily_xp_grants.profile_id
        and p.user_id = auth.uid()
    )
  );

grant select on public.profile_daily_xp_grants to authenticated;

