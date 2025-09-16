create extension if not exists "pgcrypto";

create table if not exists public.competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  start_date timestamptz not null,
  end_date timestamptz not null,
  prize_pool numeric not null default 0,
  entry_fee numeric not null default 0,
  max_participants integer not null default 0,
  category text not null default 'general',
  requirements jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint competitions_dates_check check (end_date > start_date)
);

create table if not exists public.competition_participants (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  score numeric not null default 0,
  joined_at timestamptz not null default now(),
  final_rank integer,
  prize_amount numeric not null default 0,
  awarded_at timestamptz
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.competition_participants'::regclass
      and conname = 'competition_participants_competition_id_profile_id_key'
  ) then
    alter table public.competition_participants
      add constraint competition_participants_competition_id_profile_id_key unique (competition_id, profile_id);
  end if;
end
$$;

create table if not exists public.player_rankings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  ranking_type text not null default 'global',
  rank integer not null,
  score numeric not null default 0,
  total_plays numeric not null default 0,
  hit_songs integer not null default 0,
  trend text not null default 'same',
  calculated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.player_rankings'::regclass
      and conname = 'player_rankings_profile_id_ranking_type_key'
  ) then
    alter table public.player_rankings
      add constraint player_rankings_profile_id_ranking_type_key unique (profile_id, ranking_type);
  end if;
end
$$;

create index if not exists competition_participants_competition_id_idx
  on public.competition_participants (competition_id);

create index if not exists competition_participants_profile_id_idx
  on public.competition_participants (profile_id);

create index if not exists player_rankings_ranking_type_rank_idx
  on public.player_rankings (ranking_type, rank);
