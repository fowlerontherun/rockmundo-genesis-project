-- Issue #2002: metadata catalogue for the already uploaded RockMundo crowd pack.
-- Uploaded assets are STAGED until an admin explicitly confirms their rights.
-- This does not disrupt gig_crowd_sounds or existing player audio.
create table if not exists public.crowd_audio_assets (
  id uuid primary key default gen_random_uuid(),
  legacy_sound_id uuid unique references public.gig_crowd_sounds(id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 150),
  storage_path text not null unique check (length(trim(storage_path)) > 0),
  category text not null check (category in ('ambient','applause','cheer','encore','finale','reaction')),
  crowd_size text not null default 'any' check (crowd_size in ('small','medium','large','any')),
  environments text[] not null default array['any']::text[]
    check (array_length(environments, 1) between 1 and 8 and
           environments <@ array['pub','club','indoor','arena','festival','outdoor','studio','any']::text[]),
  intensity smallint not null default 3 check (intensity between 1 and 5),
  duration_seconds numeric(10,2) check (duration_seconds is null or duration_seconds > 0),
  loopable boolean not null default false,
  gain_db numeric(6,2) not null default -9 check (gain_db between -60 and 6),
  fade_in_ms integer not null default 150 check (fade_in_ms between 0 and 10000),
  fade_out_ms integer not null default 250 check (fade_out_ms between 0 and 10000),
  cue_start_seconds numeric(10,2) not null default 0 check (cue_start_seconds >= 0),
  cue_end_seconds numeric(10,2) check (cue_end_seconds is null or cue_end_seconds > cue_start_seconds),
  enabled boolean not null default false,
  source_notes text,
  rights_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crowd_audio_trim_within_duration check (
    duration_seconds is null or
    (cue_start_seconds < duration_seconds and (cue_end_seconds is null or cue_end_seconds <= duration_seconds))
  ),
  constraint crowd_audio_no_unconfirmed_playback check (not enabled or rights_confirmed)
);
create index if not exists crowd_audio_enabled_category_idx
  on public.crowd_audio_assets(category, crowd_size, intensity)
  where enabled and rights_confirmed;

alter table public.crowd_audio_assets enable row level security;
revoke all on table public.crowd_audio_assets from public, anon, authenticated;
grant select on table public.crowd_audio_assets to anon, authenticated;
grant insert, update, delete on table public.crowd_audio_assets to authenticated;

create policy "Published crowd recordings readable" on public.crowd_audio_assets
  for select to anon, authenticated
  using (
    (enabled and rights_confirmed)
    or exists (select 1 from public.user_roles ur
               where ur.user_id = (select auth.uid()) and ur.role = 'admin')
  );
create policy "Admins manage crowd recordings" on public.crowd_audio_assets
  for all to authenticated
  using (exists (select 1 from public.user_roles ur
                 where ur.user_id = (select auth.uid()) and ur.role = 'admin'))
  with check (exists (select 1 from public.user_roles ur
                      where ur.user_id = (select auth.uid()) and ur.role = 'admin'));

-- The named 21 processed clips were uploaded on 2026-10-09. Do not
-- infer rights clearance from a file upload or the old is_active flag.
insert into public.crowd_audio_assets (
  legacy_sound_id, name, storage_path, category, crowd_size, environments,
  intensity, duration_seconds, loopable, gain_db, fade_in_ms, fade_out_ms,
  source_notes, enabled, rights_confirmed
)
select
  s.id, s.name, split_part(s.audio_url, '/crowd-sounds/', 2),
  case
    when lower(s.name) like 'ambience %' then 'ambient'
    when lower(s.name) like 'applause %' or lower(s.name) like 'totp applause%' then 'applause'
    when lower(s.name) like 'encore %' then 'encore'
    when lower(s.name) like 'finale %' then 'finale'
    when lower(s.name) like 'song end %' then 'reaction'
    when lower(s.name) like 'totp number one%' then 'reaction'
    else 'cheer'
  end,
  case
    when lower(s.name) ~ '(small|pub)' then 'small'
    when lower(s.name) ~ '(large|arena|festival)' then 'large'
    when lower(s.name) ~ '(medium|club|indoor)' then 'medium'
    else 'any'
  end,
  case
    when lower(s.name) like 'totp %' then array['studio']::text[]
    when lower(s.name) like '%pub%' then array['pub']::text[]
    when lower(s.name) like '%club%' then array['club']::text[]
    when lower(s.name) like '%indoor%' then array['indoor']::text[]
    when lower(s.name) like '%large%' then array['arena','festival','outdoor']::text[]
    else array['any']::text[]
  end,
  greatest(1, least(5, round(coalesce(s.intensity_level, 5) / 2.0)::integer)),
  s.duration_seconds, lower(s.name) like 'ambience %',
  case when lower(s.name) like 'ambience %' then -15 else -9 end,
  case when lower(s.name) like 'ambience %' then 700 else 80 end,
  case when lower(s.name) like 'ambience %' then 700 else 250 end,
  'Processed Crowd Audio Pack v1 (existing crowd-sounds storage). Verify source licence and cue trims before enabling.',
  false, false
from public.gig_crowd_sounds s
where split_part(s.audio_url, '/crowd-sounds/', 2) ~ '^17915483(4|5)[0-9]+-[0-9]+-'
on conflict (legacy_sound_id) do nothing;

comment on table public.crowd_audio_assets is
  'Issue 2002: admin-curated rights-gated crowd audio catalogue, staged from existing processed recordings.';
