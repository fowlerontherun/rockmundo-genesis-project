set check_function_bodies = off;

-- Busking locations define street performance spots across the city
create table if not exists public.busking_locations (
    id uuid primary key default gen_random_uuid(),
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
    created_at timestamptz not null default timezone('utc', now()),
    constraint busking_locations_risk_level_check check (risk_level in ('low', 'medium', 'high', 'extreme')),
    constraint busking_locations_cooldown_positive check (cooldown_minutes > 0),
    constraint busking_locations_name_key unique (name)
);

comment on table public.busking_locations is 'Street performance locations available for busking sessions.';

-- Modifiers represent situational bonuses or challenges the player can select
create table if not exists public.busking_modifiers (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text,
    rarity text not null default 'common',
    payout_multiplier numeric(5,2) not null default 1.00,
    fame_multiplier numeric(5,2) not null default 1.00,
    experience_bonus integer not null default 0,
    risk_modifier numeric(5,2) not null default 0.00,
    created_at timestamptz not null default timezone('utc', now()),
    constraint busking_modifiers_rarity_check check (rarity in ('common', 'uncommon', 'rare', 'legendary')),
    constraint busking_modifiers_name_key unique (name)
);

comment on table public.busking_modifiers is 'Situational modifiers that alter the risk/reward profile of busking runs.';

-- Sessions capture each attempt a player makes while busking
create table if not exists public.busking_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    location_id uuid not null references public.busking_locations (id) on delete cascade,
    modifier_id uuid references public.busking_modifiers (id) on delete set null,
    created_at timestamptz not null default timezone('utc', now()),
    duration_minutes integer not null default 30,
    success boolean not null default false,
    cash_earned integer not null default 0,
    fame_gained integer not null default 0,
    experience_gained integer not null default 0,
    performance_score numeric(5,2) not null default 0,
    risk_level text,
    crowd_reaction text,
    notes text,
    failure_reason text,
    constraint busking_sessions_risk_level_check check (risk_level is null or risk_level in ('low', 'medium', 'high', 'extreme')),
    constraint busking_sessions_duration_positive check (duration_minutes > 0)
);

comment on table public.busking_sessions is 'History of each busking session performed by a player.';

create index if not exists busking_sessions_user_idx on public.busking_sessions (user_id, created_at desc);
create index if not exists busking_sessions_location_idx on public.busking_sessions (location_id);

-- Seed data to match the reference experience
insert into public.busking_locations (name, description, neighborhood, recommended_skill, base_payout, fame_reward, experience_reward, risk_level, ambiance, cooldown_minutes)
values
    ('Near Local Offices', 'Weekday lunch crowd of office workers eager for quick hits and covers.', 'Financial Commons', 50, 180, 10, 48, 'medium', 'Clockwork foot traffic surges at noon while security keeps an eye out.', 50),
    ('Town Center', 'Central plaza with families, tourists, and street food all afternoon.', 'Civic Plaza', 65, 260, 16, 68, 'medium', 'Community events keep energy steady with occasional festival spikes.', 70),
    ('High Street', 'Premier shopping strip packed with trendsetters and impulse tippers.', 'Retail Row', 75, 360, 22, 85, 'high', 'Boutique launches and brand pop-ups make for fierce competition.', 85),
    ('Subway Center Stage', 'A bustling underground transit hub with great acoustics.', 'Downtown Transit Plaza', 45, 140, 8, 40, 'low', 'Echoing tunnels amplify your sound, commuters pass by quickly.', 45),
    ('Riverside Boardwalk', 'Open-air walkway beside the river, popular during sunsets.', 'Harbor District', 60, 220, 12, 55, 'medium', 'Tourists stroll slowly, perfect for ballads and duets.', 60),
    ('Night Market Spotlight', 'Energetic evening market with vibrant crowds.', 'Old Town Bazaar', 70, 320, 18, 75, 'high', 'Vendors cheer you on but noise levels spike unpredictably.', 75),
    ('Skyline Overlook', 'Scenic rooftop park visited by influencers and vloggers.', 'Skyline Heights', 80, 420, 24, 90, 'high', 'Stunning views attract attention but the wind can be unforgiving.', 90),
    ('Festival Pop-Up Stage', 'Temporary stage during seasonal festivals, massive foot traffic.', 'Festival Grounds', 85, 520, 30, 120, 'extreme', 'Crowd is massive but expectations are sky high.', 120)
on conflict (name) do nothing;

insert into public.busking_modifiers (name, description, rarity, payout_multiplier, fame_multiplier, experience_bonus, risk_modifier)
values
    ('Acoustic Purist', 'Rely on pure skill with no backing tracks. Higher respect, lower cushion.', 'common', 1.10, 1.05, 10, 0.15),
    ('Crowd Hype Crew', 'Friends warm up the crowd before you play.', 'uncommon', 1.25, 1.30, 20, -0.10),
    ('Merch Table Setup', 'Sell limited-run merch while performing.', 'rare', 1.45, 1.10, 25, 0.05),
    ('City Permit Spotlight', 'Officially sanctioned performance spot with city promotion.', 'rare', 1.60, 1.45, 35, -0.05),
    ('Viral Stream Collab', 'Livestream collaboration with a popular influencer.', 'legendary', 1.90, 1.80, 40, 0.20)
on conflict (name) do nothing;

-- Apply row level security to protect player data
alter table public.busking_locations enable row level security;
alter table public.busking_modifiers enable row level security;
alter table public.busking_sessions enable row level security;

create policy if not exists "Busking locations are publicly readable" on public.busking_locations
  for select using (true);

create policy if not exists "Busking modifiers are publicly readable" on public.busking_modifiers
  for select using (true);

create policy if not exists "Users can view their busking sessions" on public.busking_sessions
  for select using (auth.uid() = user_id);

create policy if not exists "Users can create busking sessions" on public.busking_sessions
  for insert with check (auth.uid() = user_id);

create policy if not exists "Users can update their busking sessions" on public.busking_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
