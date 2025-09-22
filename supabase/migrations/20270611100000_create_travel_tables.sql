set check_function_bodies = off;

-- High-level travel routes between cities
create table if not exists public.travel_flights (
  id uuid primary key default gen_random_uuid(),
  city_from uuid not null references public.cities(id) on delete restrict,
  city_to uuid not null references public.cities(id) on delete restrict,
  cost numeric(10, 2) not null check (cost >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  health_impact integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint travel_flights_route_key unique (city_from, city_to)
);

comment on table public.travel_flights is 'Commercial flight connections between major music hubs.';

create index if not exists travel_flights_city_from_idx on public.travel_flights (city_from);
create index if not exists travel_flights_city_to_idx on public.travel_flights (city_to);

alter table public.travel_flights enable row level security;

create policy if not exists "Travel flights are viewable by everyone"
  on public.travel_flights for select
  using (true);

create policy if not exists "Service roles manage travel flights"
  on public.travel_flights for all
  using (auth.role() in ('service_role', 'supabase_admin'))
  with check (auth.role() in ('service_role', 'supabase_admin'));

-- Rail connections for overland travel
create table if not exists public.travel_trains (
  id uuid primary key default gen_random_uuid(),
  city_from uuid not null references public.cities(id) on delete restrict,
  city_to uuid not null references public.cities(id) on delete restrict,
  cost numeric(10, 2) not null check (cost >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  health_impact integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint travel_trains_route_key unique (city_from, city_to)
);

comment on table public.travel_trains is 'Intercity train routes balancing speed, cost, and comfort.';

create index if not exists travel_trains_city_from_idx on public.travel_trains (city_from);
create index if not exists travel_trains_city_to_idx on public.travel_trains (city_to);

alter table public.travel_trains enable row level security;

create policy if not exists "Travel trains are viewable by everyone"
  on public.travel_trains for select
  using (true);

create policy if not exists "Service roles manage travel trains"
  on public.travel_trains for all
  using (auth.role() in ('service_role', 'supabase_admin'))
  with check (auth.role() in ('service_role', 'supabase_admin'));

-- Local taxi and rideshare transfers inside a city
create table if not exists public.travel_taxis (
  id uuid primary key default gen_random_uuid(),
  city_from uuid not null references public.cities(id) on delete restrict,
  city_to uuid not null references public.cities(id) on delete restrict,
  cost numeric(10, 2) not null check (cost >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  health_impact integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint travel_taxis_route_key unique (city_from, city_to)
);

comment on table public.travel_taxis is 'Short-haul taxi transfers for moving between venues and districts.';

create index if not exists travel_taxis_city_from_idx on public.travel_taxis (city_from);
create index if not exists travel_taxis_city_to_idx on public.travel_taxis (city_to);

alter table public.travel_taxis enable row level security;

create policy if not exists "Travel taxis are viewable by everyone"
  on public.travel_taxis for select
  using (true);

create policy if not exists "Service roles manage travel taxis"
  on public.travel_taxis for all
  using (auth.role() in ('service_role', 'supabase_admin'))
  with check (auth.role() in ('service_role', 'supabase_admin'));

-- Water-based ferry connections between coastal hubs
create table if not exists public.travel_ferries (
  id uuid primary key default gen_random_uuid(),
  city_from uuid not null references public.cities(id) on delete restrict,
  city_to uuid not null references public.cities(id) on delete restrict,
  cost numeric(10, 2) not null check (cost >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  health_impact integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint travel_ferries_route_key unique (city_from, city_to)
);

comment on table public.travel_ferries is 'Ferry services linking waterfront cities and festival ports.';

create index if not exists travel_ferries_city_from_idx on public.travel_ferries (city_from);
create index if not exists travel_ferries_city_to_idx on public.travel_ferries (city_to);

alter table public.travel_ferries enable row level security;

create policy if not exists "Travel ferries are viewable by everyone"
  on public.travel_ferries for select
  using (true);

create policy if not exists "Service roles manage travel ferries"
  on public.travel_ferries for all
  using (auth.role() in ('service_role', 'supabase_admin'))
  with check (auth.role() in ('service_role', 'supabase_admin'));

-- Seed flight routes across major hubs
with route_data as (
  select *
  from (values
    ('Neo Tokyo', 'Asterhaven', 880.00::numeric, 720, -12),
    ('Solace City', 'Vela Horizonte', 540.00::numeric, 420, -8),
    ('Asterhaven', 'Portsmouth', 210.00::numeric, 110, -4)
  ) as v(city_from_name, city_to_name, cost, duration_minutes, health_impact)
)
insert into public.travel_flights (city_from, city_to, cost, duration_minutes, health_impact)
select
  cf.id,
  ct.id,
  route_data.cost,
  route_data.duration_minutes,
  route_data.health_impact
from route_data
join public.cities cf on cf.name = route_data.city_from_name
join public.cities ct on ct.name = route_data.city_to_name
on conflict (city_from, city_to) do nothing;

-- Seed representative train journeys
with route_data as (
  select *
  from (values
    ('Portsmouth', 'Asterhaven', 95.00::numeric, 180, -2),
    ('Asterhaven', 'Solace City', 135.00::numeric, 240, -3),
    ('Solace City', 'Portsmouth', 115.00::numeric, 210, -1)
  ) as v(city_from_name, city_to_name, cost, duration_minutes, health_impact)
)
insert into public.travel_trains (city_from, city_to, cost, duration_minutes, health_impact)
select
  cf.id,
  ct.id,
  route_data.cost,
  route_data.duration_minutes,
  route_data.health_impact
from route_data
join public.cities cf on cf.name = route_data.city_from_name
join public.cities ct on ct.name = route_data.city_to_name
on conflict (city_from, city_to) do nothing;

-- Seed local taxi hops for venue shuttles
with route_data as (
  select *
  from (values
    ('Portsmouth', 'Portsmouth', 24.00::numeric, 18, 3),
    ('Solace City', 'Solace City', 32.00::numeric, 22, 4),
    ('Asterhaven', 'Asterhaven', 38.00::numeric, 25, 2)
  ) as v(city_from_name, city_to_name, cost, duration_minutes, health_impact)
)
insert into public.travel_taxis (city_from, city_to, cost, duration_minutes, health_impact)
select
  cf.id,
  ct.id,
  route_data.cost,
  route_data.duration_minutes,
  route_data.health_impact
from route_data
join public.cities cf on cf.name = route_data.city_from_name
join public.cities ct on ct.name = route_data.city_to_name
on conflict (city_from, city_to) do nothing;

-- Seed ferry crossings for waterfront festivals
with route_data as (
  select *
  from (values
    ('Solace City', 'Portsmouth', 68.00::numeric, 95, 5),
    ('Portsmouth', 'Vela Horizonte', 145.00::numeric, 260, 1),
    ('Vela Horizonte', 'Solace City', 142.00::numeric, 255, 2)
  ) as v(city_from_name, city_to_name, cost, duration_minutes, health_impact)
)
insert into public.travel_ferries (city_from, city_to, cost, duration_minutes, health_impact)
select
  cf.id,
  ct.id,
  route_data.cost,
  route_data.duration_minutes,
  route_data.health_impact
from route_data
join public.cities cf on cf.name = route_data.city_from_name
join public.cities ct on ct.name = route_data.city_to_name
on conflict (city_from, city_to) do nothing;

-- Refresh PostgREST schema cache so the new travel tables are immediately available
notify pgrst, 'reload schema';
