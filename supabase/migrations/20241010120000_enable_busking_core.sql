-- Ensure profile activity statuses table exists with metadata support for activity tracking
create table if not exists public.profile_activity_statuses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null,
  started_at timestamptz not null default timezone('utc', now()),
  duration_minutes integer,
  ends_at timestamptz generated always as (
    case
      when duration_minutes is null then null
      else started_at + make_interval(mins => duration_minutes)
    end
  ) stored,
  song_id uuid references public.songs(id) on delete set null,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profile_activity_statuses_duration_check check (duration_minutes is null or duration_minutes >= 0)
);

create unique index if not exists profile_activity_statuses_profile_id_key
  on public.profile_activity_statuses (profile_id);

create index if not exists profile_activity_statuses_song_id_idx
  on public.profile_activity_statuses (song_id);

create or replace function public.set_profile_activity_status_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists profile_activity_statuses_set_updated_at
  on public.profile_activity_statuses;

create trigger profile_activity_statuses_set_updated_at
  before update on public.profile_activity_statuses
  for each row
  execute function public.set_profile_activity_status_updated_at();

alter table public.profile_activity_statuses enable row level security;

drop policy if exists "Profile activity statuses are viewable by everyone"
  on public.profile_activity_statuses;
create policy "Profile activity statuses are viewable by everyone"
  on public.profile_activity_statuses
  for select
  using (true);

drop policy if exists "Profiles manage their own activity status"
  on public.profile_activity_statuses;
create policy "Profiles manage their own activity status"
  on public.profile_activity_statuses
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = profile_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = profile_id
        and p.user_id = auth.uid()
    )
  );

alter table public.activity_feed
  add column if not exists status text,
  add column if not exists duration_minutes integer,
  add column if not exists status_id uuid references public.profile_activity_statuses(id) on delete set null,
  add constraint if not exists activity_feed_duration_check
    check (duration_minutes is null or duration_minutes >= 0);

alter table public.activity_feed
  add column if not exists metadata jsonb;

-- Lightweight jam session table that matches the gameplay feature set
create table if not exists public.jam_sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  genre text not null default 'rock',
  tempo integer not null default 120,
  max_participants integer not null default 8,
  current_participants integer not null default 1,
  participant_ids uuid[] not null default array[]::uuid[],
  skill_requirement integer not null default 40,
  is_private boolean not null default false,
  access_code text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists jam_sessions_host_id_idx on public.jam_sessions (host_id);
create index if not exists jam_sessions_created_at_idx on public.jam_sessions (created_at desc);

create or replace function public.set_jam_sessions_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists jam_sessions_set_updated_at on public.jam_sessions;
create trigger jam_sessions_set_updated_at
  before update on public.jam_sessions
  for each row
  execute function public.set_jam_sessions_updated_at();

alter table public.jam_sessions enable row level security;

drop policy if exists "Jam sessions are viewable by authenticated users" on public.jam_sessions;
create policy "Jam sessions are viewable by authenticated users"
  on public.jam_sessions
  for select
  using (auth.uid() is not null);

drop policy if exists "Hosts can create jam sessions" on public.jam_sessions;
create policy "Hosts can create jam sessions"
  on public.jam_sessions
  for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = host_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "Hosts can manage jam sessions" on public.jam_sessions;
create policy "Hosts can manage jam sessions"
  on public.jam_sessions
  for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = host_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = host_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "Hosts can delete jam sessions" on public.jam_sessions;
create policy "Hosts can delete jam sessions"
  on public.jam_sessions
  for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = host_id and p.user_id = auth.uid()
    )
  );

-- Core busking tables used by the gameplay loop
create table if not exists public.busking_locations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  neighborhood text,
  recommended_skill integer not null default 50,
  base_payout integer not null default 120,
  fame_reward integer not null default 6,
  experience_reward integer not null default 35,
  risk_level text not null default 'medium',
  ambiance text,
  cooldown_minutes integer not null default 60,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.busking_modifiers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  rarity text not null default 'common',
  payout_multiplier numeric(5,2) not null default 1.00,
  fame_multiplier numeric(5,2) not null default 1.00,
  experience_bonus integer not null default 0,
  risk_modifier numeric(5,2) not null default 0.00,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.busking_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  location_id uuid not null references public.busking_locations(id) on delete cascade,
  modifier_id uuid references public.busking_modifiers(id) on delete set null,
  duration_minutes integer not null,
  success boolean not null default false,
  cash_earned integer not null default 0,
  fame_gained integer not null default 0,
  experience_gained integer not null default 0,
  performance_score numeric(5,2) not null default 0,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists busking_sessions_user_idx on public.busking_sessions (user_id, created_at desc);
create index if not exists busking_sessions_profile_idx on public.busking_sessions (profile_id, created_at desc);
create index if not exists busking_sessions_location_idx on public.busking_sessions (location_id);

alter table public.busking_locations enable row level security;
alter table public.busking_modifiers enable row level security;
alter table public.busking_sessions enable row level security;

create policy if not exists "Busking locations are publicly readable" on public.busking_locations
  for select using (true);

create policy if not exists "Busking modifiers are publicly readable" on public.busking_modifiers
  for select using (true);

create policy if not exists "Users can view their busking sessions" on public.busking_sessions
  for select
  using (auth.uid() = user_id);

create policy if not exists "Users can insert their busking sessions" on public.busking_sessions
  for insert
  with check (auth.uid() = user_id);

create policy if not exists "Users can update their busking sessions" on public.busking_sessions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy if not exists "Users can delete their busking sessions" on public.busking_sessions
  for delete
  using (auth.uid() = user_id);

-- Seed a baseline set of busking locations
insert into public.busking_locations (slug, name, description, neighborhood, recommended_skill, base_payout, fame_reward, experience_reward, risk_level, ambiance, cooldown_minutes)
values
  ('market-square', 'Market Square', 'Bustling stalls and coffee carts keep lunchtime crowds lingering.', 'Old Town', 55, 160, 8, 48, 'medium', 'Midday bustle from street vendors and office workers.', 45),
  ('river-promenade', 'River Promenade', 'Evening strollers and bus tours bring a steady flow of tipsy tippers.', 'Harborfront', 60, 200, 12, 58, 'medium', 'Sunset rush along the waterfront.', 60),
  ('night-market', 'Neon Night Market', 'Street food, neon booths, and late-night creatives pack the walkways.', 'Arts District', 70, 260, 16, 72, 'high', 'After-dark energy with heavy foot traffic.', 80)
on conflict (slug) do nothing;

insert into public.busking_modifiers (name, description, rarity, payout_multiplier, fame_multiplier, experience_bonus, risk_modifier)
values
  ('Acoustic Purist', 'Rely on pure skill with no backing tracks. Higher respect, lower cushion.', 'common', 1.10, 1.05, 10, 0.15),
  ('Crowd Hype Crew', 'Friends warm up the crowd before you play.', 'uncommon', 1.25, 1.30, 20, -0.10),
  ('Merch Table Setup', 'Sell limited-run merch while performing.', 'rare', 1.45, 1.10, 25, 0.05)
on conflict (name) do nothing;
