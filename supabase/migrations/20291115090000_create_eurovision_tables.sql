-- Create Eurovision support tables
create table if not exists public.eurovision_years (
  id uuid primary key default gen_random_uuid(),
  year integer not null unique,
  host_city text,
  host_country text,
  theme text,
  created_at timestamptz not null default now()
);

create table if not exists public.eurovision_entries (
  id uuid primary key default gen_random_uuid(),
  year_id uuid not null references public.eurovision_years(id) on delete cascade,
  band_id uuid references public.bands(id),
  song_id uuid references public.songs(id),
  country text not null,
  song_title text,
  running_order integer,
  final_score integer,
  created_at timestamptz not null default now(),
  unique(year_id, country)
);

create table if not exists public.eurovision_votes (
  id uuid primary key default gen_random_uuid(),
  year_id uuid not null references public.eurovision_years(id) on delete cascade,
  entry_id uuid not null references public.eurovision_entries(id) on delete cascade,
  from_country text not null,
  vote_type text,
  points integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.eurovision_winners (
  id uuid primary key default gen_random_uuid(),
  year_id uuid unique not null references public.eurovision_years(id) on delete cascade,
  entry_id uuid references public.eurovision_entries(id) on delete set null,
  song_id uuid references public.songs(id),
  created_at timestamptz not null default now()
);

create index if not exists eurovision_years_year_idx on public.eurovision_years(year);
create index if not exists eurovision_entries_country_idx on public.eurovision_entries(country);
