-- Isolated PostgreSQL CI ONLY. External social/privacy contracts needed by
-- 28 October City Scene additions. Never apply this fixture to production.
create type public.profile_visibility_scope as enum ('public','friends','private','band_members');

alter table public.profiles
  add column username varchar(120),
  add column display_name varchar(120);

create table public.profile_privacy_settings (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  profile_visibility public.profile_visibility_scope not null default 'public',
  activity_visibility public.profile_visibility_scope not null default 'friends'
);
create table public.player_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  visibility public.profile_visibility_scope not null default 'private',
  show_activity boolean not null default false
);
create table public.player_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id),
  blocked_id uuid not null references public.profiles(id),
  removed_at timestamptz
);
create table public.profile_mutes (
  id uuid primary key default gen_random_uuid(),
  viewer_profile_id uuid not null references public.profiles(id),
  target_profile_id uuid not null references public.profiles(id),
  mute_until timestamptz,
  removed_at timestamptz
);
