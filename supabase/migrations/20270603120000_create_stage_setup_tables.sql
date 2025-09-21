-- Create tables for stage setup management
set check_function_bodies = off;

create extension if not exists "uuid-ossp";

create table if not exists public.stage_band_roles (
    id uuid primary key default uuid_generate_v4(),
    created_at timestamptz not null default now(),
    role text not null,
    instrument text not null,
    amps text[] not null default '{}'::text[],
    monitors text[] not null default '{}'::text[],
    notes text[] not null default '{}'::text[]
);

create table if not exists public.stage_pedalboard_items (
    id uuid primary key default uuid_generate_v4(),
    created_at timestamptz not null default now(),
    band_role_id uuid not null references public.stage_band_roles(id) on delete cascade,
    position integer not null,
    pedal text not null,
    notes text,
    power_draw text
);

create table if not exists public.stage_rig_systems (
    id uuid primary key default uuid_generate_v4(),
    created_at timestamptz not null default now(),
    system text not null,
    status text not null,
    coverage text,
    details text[] not null default '{}'::text[]
);

create table if not exists public.stage_crew_roles (
    id uuid primary key default uuid_generate_v4(),
    created_at timestamptz not null default now(),
    specialty text not null,
    headcount integer not null default 1,
    responsibilities text,
    skill integer not null default 0
);

create table if not exists public.stage_setup_metrics (
    id uuid primary key default uuid_generate_v4(),
    created_at timestamptz not null default now(),
    rating integer not null default 0,
    max_rating integer not null default 100,
    current_wattage integer,
    max_db integer
);

create unique index if not exists stage_setup_metrics_singleton on public.stage_setup_metrics ((true));

create unique index if not exists stage_pedalboard_items_role_position_idx
    on public.stage_pedalboard_items(band_role_id, position);

-- Down migration

-- The following statements are no-ops when run during deployment migrations.
-- They exist to support local development rollbacks.

--#ifdef DOWN

drop index if exists stage_pedalboard_items_role_position_idx;
drop index if exists stage_setup_metrics_singleton;
drop table if exists public.stage_setup_metrics;
drop table if exists public.stage_crew_roles;
drop table if exists public.stage_rig_systems;
drop table if exists public.stage_pedalboard_items;
drop table if exists public.stage_band_roles;

--#endif
