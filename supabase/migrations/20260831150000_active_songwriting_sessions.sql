-- Active Sessions Phase 2: optional songwriting puzzles.
-- Scheduled songwriting remains the primary progression route; these rewards are intentionally small and capped.

create table if not exists public.active_songwriting_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.songwriting_projects(id) on delete cascade,
  user_id uuid not null,
  score integer not null check (score between 0 and 100),
  score_breakdown jsonb not null default '{}'::jsonb,
  music_progress_gained integer not null default 0,
  lyrics_progress_gained integer not null default 0,
  played_at timestamptz not null default now()
);

-- Converge databases that briefly received the initial prototype shape.
alter table public.active_songwriting_sessions
  add column if not exists score_breakdown jsonb not null default '{}'::jsonb;
alter table public.active_songwriting_sessions
  drop constraint if exists active_songwriting_sessions_puzzle_type_check;
alter table public.active_songwriting_sessions
  drop column if exists puzzle_type;
alter table public.active_songwriting_sessions
  drop column if exists xp_earned;

alter table public.active_songwriting_sessions enable row level security;

drop policy if exists "active songwriting sessions own select" on public.active_songwriting_sessions;
create policy "active songwriting sessions own select"
on public.active_songwriting_sessions
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.active_songwriting_sessions from anon;
revoke insert, update, delete on table public.active_songwriting_sessions from authenticated;
grant select on table public.active_songwriting_sessions to authenticated;

create index if not exists active_songwriting_sessions_profile_played_idx
  on public.active_songwriting_sessions(profile_id, played_at desc);
create index if not exists active_songwriting_sessions_project_idx
  on public.active_songwriting_sessions(project_id, played_at desc);

drop function if exists public.submit_active_songwriting_session(uuid, uuid, text, integer);

create or replace function public.submit_active_songwriting_session(
  p_profile_id uuid,
  p_project_id uuid,
  p_lyrics_score integer,
  p_chords_score integer,
  p_melody_score integer,
  p_arrangement_score integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_project public.songwriting_projects%rowtype;
  v_sessions_today integer := 0;
  v_factor numeric := 1;
  v_overall_score integer;
  v_music_strength numeric;
  v_lyrics_strength numeric;
  v_music integer := 0;
  v_lyrics integer := 0;
  v_new_music integer;
  v_new_lyrics integer;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  if p_lyrics_score not in (0, 100)
    or p_chords_score not in (0, 100)
    or p_melody_score not in (0, 100)
    or p_arrangement_score not in (0, 100) then
    raise exception 'Puzzle scores must be either 0 or 100.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_profile_id
      and user_id = v_user
  ) then
    raise exception 'This character is not available.' using errcode = 'P0001';
  end if;

  select * into v_project
  from public.songwriting_projects
  where id = p_project_id
  for update;

  if not found then
    raise exception 'The songwriting project is no longer available.' using errcode = 'P0001';
  end if;

  if v_project.profile_id is distinct from p_profile_id then
    raise exception 'This project belongs to another character.' using errcode = 'P0001';
  end if;

  if v_project.status in ('completed', 'complete', 'converted') or v_project.song_id is not null then
    raise exception 'This song is already complete.' using errcode = 'P0001';
  end if;

  if v_project.locked_until is not null and v_project.locked_until > now() then
    raise exception 'Finish the current songwriting session before starting Active Writing on this song.' using errcode = 'P0001';
  end if;

  select count(*) into v_sessions_today
  from public.active_songwriting_sessions
  where profile_id = p_profile_id
    and played_at >= date_trunc('day', now());

  v_overall_score := round((p_lyrics_score + p_chords_score + p_melody_score + p_arrangement_score) / 4.0);

  if v_sessions_today >= 12 then
    return jsonb_build_object(
      'awarded', false,
      'reason', 'daily_cap',
      'sessions_today', v_sessions_today,
      'music_progress_gained', 0,
      'lyrics_progress_gained', 0,
      'overall_score', v_overall_score
    );
  end if;

  if v_sessions_today >= 8 then
    v_factor := 0.25;
  elsif v_sessions_today >= 4 then
    v_factor := 0.5;
  end if;

  v_music_strength := (p_chords_score + p_melody_score + p_arrangement_score) / 3.0;
  v_lyrics_strength := (p_lyrics_score + p_arrangement_score) / 2.0;

  v_music := greatest(1, round((4 + (v_music_strength * 0.10)) * v_factor));
  v_lyrics := greatest(1, round((3 + (v_lyrics_strength * 0.08)) * v_factor));

  v_new_music := least(2000, coalesce(v_project.music_progress, 0) + v_music);
  v_new_lyrics := least(2000, coalesce(v_project.lyrics_progress, 0) + v_lyrics);
  v_music := v_new_music - coalesce(v_project.music_progress, 0);
  v_lyrics := v_new_lyrics - coalesce(v_project.lyrics_progress, 0);

  update public.songwriting_projects
  set music_progress = v_new_music,
      lyrics_progress = v_new_lyrics,
      updated_at = now()
  where id = p_project_id;

  insert into public.active_songwriting_sessions (
    profile_id,
    project_id,
    user_id,
    score,
    score_breakdown,
    music_progress_gained,
    lyrics_progress_gained
  ) values (
    p_profile_id,
    p_project_id,
    v_user,
    v_overall_score,
    jsonb_build_object(
      'lyrics', p_lyrics_score,
      'chords', p_chords_score,
      'melody', p_melody_score,
      'arrangement', p_arrangement_score
    ),
    v_music,
    v_lyrics
  );

  return jsonb_build_object(
    'awarded', true,
    'sessions_today', v_sessions_today + 1,
    'diminishing', v_factor < 1,
    'factor', v_factor,
    'overall_score', v_overall_score,
    'music_progress_gained', v_music,
    'lyrics_progress_gained', v_lyrics,
    'music_progress', v_new_music,
    'lyrics_progress', v_new_lyrics
  );
end;
$$;

revoke all on function public.submit_active_songwriting_session(uuid, uuid, integer, integer, integer, integer) from public;
revoke all on function public.submit_active_songwriting_session(uuid, uuid, integer, integer, integer, integer) from anon;
grant execute on function public.submit_active_songwriting_session(uuid, uuid, integer, integer, integer, integer) to authenticated;
