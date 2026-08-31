-- Active Sessions Phase 3: optional rehearsal groove minigame.
-- Booked rehearsals remain the primary band rehearsal route.

create table if not exists public.active_rehearsal_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  band_id uuid not null references public.bands(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  user_id uuid not null,
  score integer not null check (score between 0 and 100),
  perfect_hits integer not null default 0,
  tight_hits integer not null default 0,
  recovery_hits integer not null default 0,
  lost_hits integer not null default 0,
  familiarity_minutes_gained integer not null default 0,
  cohesion_gained integer not null default 0,
  played_at timestamptz not null default now()
);

alter table public.active_rehearsal_sessions enable row level security;

drop policy if exists "active rehearsal sessions own select" on public.active_rehearsal_sessions;
create policy "active rehearsal sessions own select"
on public.active_rehearsal_sessions for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.active_rehearsal_sessions from anon;
revoke insert, update, delete on table public.active_rehearsal_sessions from authenticated;
grant select on table public.active_rehearsal_sessions to authenticated;

create index if not exists active_rehearsal_sessions_profile_played_idx
  on public.active_rehearsal_sessions(profile_id, played_at desc);
create index if not exists active_rehearsal_sessions_band_song_idx
  on public.active_rehearsal_sessions(band_id, song_id, played_at desc);

create or replace function public.submit_active_rehearsal_session(
  p_profile_id uuid,
  p_band_id uuid,
  p_song_id uuid,
  p_score integer,
  p_perfect_hits integer,
  p_tight_hits integer,
  p_recovery_hits integer,
  p_lost_hits integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_sessions_today integer := 0;
  v_factor numeric := 1;
  v_minutes integer := 0;
  v_cohesion integer := 0;
  v_current_minutes integer := 0;
  v_new_minutes integer := 0;
  v_percentage integer := 0;
  v_total_hits integer;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode='P0001';
  end if;
  if p_score not between 0 and 100 then
    raise exception 'Score must be between 0 and 100.' using errcode='P0001';
  end if;

  v_total_hits := coalesce(p_perfect_hits,0)+coalesce(p_tight_hits,0)+coalesce(p_recovery_hits,0)+coalesce(p_lost_hits,0);
  if v_total_hits <> 12 or least(p_perfect_hits,p_tight_hits,p_recovery_hits,p_lost_hits) < 0 then
    raise exception 'A rehearsal session must contain exactly 12 scored beats.' using errcode='P0001';
  end if;

  if not exists (select 1 from public.profiles where id=p_profile_id and user_id=v_user) then
    raise exception 'This character is not available.' using errcode='P0001';
  end if;
  if not public._band_active_member(p_band_id,p_profile_id) then
    raise exception 'You must be an active member of this band.' using errcode='P0001';
  end if;
  if not exists (
    select 1 from public.songs s
    where s.id=p_song_id
      and (s.band_id=p_band_id or s.profile_id=p_profile_id)
      and coalesce(s.archived,false)=false
  ) then
    raise exception 'This song is not available to rehearse.' using errcode='P0001';
  end if;

  select count(*) into v_sessions_today
  from public.active_rehearsal_sessions
  where profile_id=p_profile_id and played_at>=date_trunc('day',now());

  if v_sessions_today >= 10 then
    return jsonb_build_object('awarded',false,'reason','daily_cap','sessions_today',v_sessions_today,'familiarity_minutes_gained',0,'cohesion_gained',0);
  end if;
  if v_sessions_today >= 7 then v_factor:=0.25;
  elsif v_sessions_today >= 4 then v_factor:=0.5;
  end if;

  v_minutes := greatest(1, round((2 + p_score * 0.08) * v_factor));
  if p_score >= 85 and v_sessions_today < 2 then v_cohesion:=1; end if;

  select familiarity_minutes into v_current_minutes
  from public.band_song_familiarity
  where band_id=p_band_id and song_id=p_song_id
  for update;
  v_current_minutes := coalesce(v_current_minutes,0);
  v_new_minutes := least(360,v_current_minutes+v_minutes);
  v_minutes := v_new_minutes-v_current_minutes;
  v_percentage := least(100,round((v_new_minutes/360.0)*100));

  insert into public.band_song_familiarity(band_id,song_id,familiarity_minutes,familiarity_percentage,last_rehearsed_at,updated_at)
  values(p_band_id,p_song_id,v_new_minutes,v_percentage,now(),now())
  on conflict (band_id,song_id) do update set
    familiarity_minutes=excluded.familiarity_minutes,
    familiarity_percentage=excluded.familiarity_percentage,
    last_rehearsed_at=excluded.last_rehearsed_at,
    updated_at=excluded.updated_at;

  if v_cohesion > 0 then
    update public.bands set cohesion_score=least(100,coalesce(cohesion_score,0)+v_cohesion),updated_at=now() where id=p_band_id;
  end if;

  insert into public.active_rehearsal_sessions(profile_id,band_id,song_id,user_id,score,perfect_hits,tight_hits,recovery_hits,lost_hits,familiarity_minutes_gained,cohesion_gained)
  values(p_profile_id,p_band_id,p_song_id,v_user,p_score,p_perfect_hits,p_tight_hits,p_recovery_hits,p_lost_hits,v_minutes,v_cohesion);

  return jsonb_build_object(
    'awarded',true,'sessions_today',v_sessions_today+1,'diminishing',v_factor<1,'factor',v_factor,
    'familiarity_minutes_gained',v_minutes,'familiarity_minutes',v_new_minutes,'familiarity_percentage',v_percentage,'cohesion_gained',v_cohesion
  );
end;
$$;

revoke all on function public.submit_active_rehearsal_session(uuid,uuid,uuid,integer,integer,integer,integer,integer) from public;
revoke all on function public.submit_active_rehearsal_session(uuid,uuid,uuid,integer,integer,integer,integer,integer) from anon;
grant execute on function public.submit_active_rehearsal_session(uuid,uuid,uuid,integer,integer,integer,integer,integer) to authenticated;
