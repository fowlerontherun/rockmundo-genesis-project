-- Minimal, isolated canonical RockMundo schema for PostgreSQL CI.
-- DO NOT run this against live or an existing RockMundo database.
-- These stubs provide only external contracts used by City Scene migrations.
create role anon;
create role authenticated;
create role service_role;
grant usage on schema public to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to authenticated, service_role;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant execute on function auth.uid() to authenticated, service_role;

create table public.cities (
  id uuid primary key default gen_random_uuid(), name varchar(120) not null
);
create table public.bands (
  id uuid primary key default gen_random_uuid()
);
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  current_city_id uuid references public.cities(id),
  is_active boolean default true,
  deleted_at timestamptz,
  last_login_at timestamptz
);
create table public.social_activities (
  id uuid primary key default gen_random_uuid(),
  city_id uuid references public.cities(id),
  activity_type text,
  status text,
  completed_at timestamptz,
  end_at timestamptz,
  band_id uuid references public.bands(id)
);
create table public.social_activity_participants (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid references public.social_activities(id),
  profile_id uuid references public.profiles(id),
  attended boolean,
  response text
);
create table public.jam_sessions (
  id uuid primary key default gen_random_uuid(),
  status varchar(40),
  completed_at timestamptz,
  started_at timestamptz,
  created_at timestamptz default now(),
  scheduled_end timestamptz,
  band_id uuid references public.bands(id),
  city_id uuid references public.cities(id)
);
create table public.jam_session_finalizations (
  session_id uuid primary key references public.jam_sessions(id),
  applied_at timestamptz not null
);
create table public.jam_session_slots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.jam_sessions(id),
  resolved_at timestamptz
);
create table public.jam_session_slot_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.jam_sessions(id),
  slot_id uuid references public.jam_session_slots(id),
  profile_id uuid references public.profiles(id)
);
create table public.recording_sessions (
  id uuid primary key default gen_random_uuid(),
  status varchar(40),
  profile_id uuid references public.profiles(id),
  user_id uuid references auth.users(id),
  city_id uuid references public.cities(id),
  band_id uuid references public.bands(id),
  scheduled_end timestamptz,
  completed_at timestamptz,
  updated_at timestamptz default now(),
  xp_awards jsonb
);
create table public.band_members (
  id uuid primary key default gen_random_uuid(),
  band_id uuid references public.bands(id),
  profile_id uuid references public.profiles(id),
  member_status varchar(40)
);
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  city_id uuid references public.cities(id)
);
create table public.gigs (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references public.venues(id),
  band_id uuid references public.bands(id),
  status varchar(40),
  cancelled_at timestamptz
);
create table public.gig_outcomes (
  id uuid primary key default gen_random_uuid(),
  gig_id uuid references public.gigs(id),
  band_id uuid references public.bands(id),
  completed_at timestamptz
);
create table public.gig_performers (
  id uuid primary key default gen_random_uuid(),
  gig_id uuid references public.gigs(id),
  band_id uuid references public.bands(id),
  profile_id uuid references public.profiles(id),
  lineup_status text,
  performed_at timestamptz
);
create table public.player_xp_wallet (
  profile_id uuid primary key references public.profiles(id),
  xp_balance integer default 0,
  lifetime_xp integer default 0,
  skill_xp_balance integer default 0,
  skill_xp_lifetime integer default 0,
  last_recalculated timestamptz default now()
);
create table public.experience_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  profile_id uuid references public.profiles(id),
  activity_type text not null,
  xp_amount integer not null default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
-- Isolated test user required for the rollback-only XP payout harness.
insert into auth.users(id)
values('10000000-0000-0000-0000-000000000001');
insert into public.cities(id,name)
values('20000000-0000-0000-0000-000000000001','Staging Music City');
insert into public.profiles(id,user_id,current_city_id,is_active,last_login_at)
values('30000000-0000-0000-0000-000000000001',
       '10000000-0000-0000-0000-000000000001',
       '20000000-0000-0000-0000-000000000001',true,now());
