-- Active Sessions Phase 4: one-time post-recording take polish.
-- Core studio/producer/performer outcome remains authoritative; this bonus is capped at +2 quality.

create table if not exists public.active_recording_sessions (
  id uuid primary key default gen_random_uuid(),
  recording_session_id uuid not null unique references public.recording_sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null,
  score integer not null check (score between 0 and 100),
  perfect_takes integer not null default 0,
  good_takes integer not null default 0,
  rough_takes integer not null default 0,
  quality_bonus integer not null default 0 check (quality_bonus between 0 and 2),
  played_at timestamptz not null default now()
);

alter table public.active_recording_sessions enable row level security;

drop policy if exists "active recording sessions own select" on public.active_recording_sessions;
create policy "active recording sessions own select"
on public.active_recording_sessions for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.active_recording_sessions from anon;
revoke insert, update, delete on table public.active_recording_sessions from authenticated;
grant select on table public.active_recording_sessions to authenticated;

create index if not exists active_recording_sessions_profile_played_idx
  on public.active_recording_sessions(profile_id, played_at desc);

create or replace function public.submit_active_recording_session(
  p_profile_id uuid,
  p_recording_session_id uuid,
  p_score integer,
  p_perfect_takes integer,
  p_good_takes integer,
  p_rough_takes integer
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := auth.uid();
  v_session public.recording_sessions%rowtype;
  v_bonus integer := 0;
  v_new_master integer;
  v_song_quality integer;
  v_total_takes integer;
begin
  if v_user is null then raise exception 'Not authenticated' using errcode='P0001'; end if;
  if p_score not between 0 and 100 then raise exception 'Score must be between 0 and 100.' using errcode='P0001'; end if;
  v_total_takes := coalesce(p_perfect_takes,0)+coalesce(p_good_takes,0)+coalesce(p_rough_takes,0);
  if v_total_takes <> 5 or least(p_perfect_takes,p_good_takes,p_rough_takes) < 0 then
    raise exception 'An Active Recording must contain exactly five kept takes.' using errcode='P0001';
  end if;

  if not exists(select 1 from public.profiles where id=p_profile_id and user_id=v_user) then
    raise exception 'This character is not available.' using errcode='P0001';
  end if;

  select * into v_session from public.recording_sessions where id=p_recording_session_id for update;
  if not found then raise exception 'Recording session not found.' using errcode='P0001'; end if;
  if v_session.status <> 'completed' then raise exception 'Finish the recording session before polishing a take.' using errcode='P0001'; end if;
  if coalesce(v_session.recording_version,'standard') <> 'standard' then
    raise exception 'Active Recording polish is currently available for standard recordings only.' using errcode='P0001';
  end if;
  if v_session.profile_id is distinct from p_profile_id and (v_session.band_id is null or not public._band_active_member(v_session.band_id,p_profile_id)) then
    raise exception 'You do not have access to this recording session.' using errcode='P0001';
  end if;
  if exists(select 1 from public.active_recording_sessions where recording_session_id=p_recording_session_id) then
    raise exception 'This recording has already had its Active Recording polish.' using errcode='P0001';
  end if;

  if p_score >= 90 then v_bonus:=2;
  elsif p_score >= 70 then v_bonus:=1;
  else v_bonus:=0;
  end if;

  v_new_master := least(100,coalesce(v_session.final_master_quality,coalesce(v_session.source_song_quality,50))+v_bonus);
  v_bonus := v_new_master-coalesce(v_session.final_master_quality,coalesce(v_session.source_song_quality,50));

  update public.recording_sessions
  set final_master_quality=v_new_master,
      quality_improvement=coalesce(quality_improvement,0)+v_bonus,
      session_data=coalesce(session_data,'{}'::jsonb)||jsonb_build_object('active_recording_polish',jsonb_build_object('score',p_score,'quality_bonus',v_bonus,'applied_at',now())),
      updated_at=now()
  where id=p_recording_session_id;

  if v_session.song_id is not null and v_bonus > 0 then
    select quality_score into v_song_quality from public.songs where id=v_session.song_id for update;
    update public.songs set quality_score=least(100,coalesce(v_song_quality,0)+v_bonus), updated_at=now() where id=v_session.song_id;
  end if;

  insert into public.active_recording_sessions(recording_session_id,profile_id,user_id,score,perfect_takes,good_takes,rough_takes,quality_bonus)
  values(p_recording_session_id,p_profile_id,v_user,p_score,p_perfect_takes,p_good_takes,p_rough_takes,v_bonus);

  return jsonb_build_object('awarded',true,'score',p_score,'quality_bonus',v_bonus,'final_master_quality',v_new_master);
end;
$$;

revoke all on function public.submit_active_recording_session(uuid,uuid,integer,integer,integer,integer) from public;
revoke all on function public.submit_active_recording_session(uuid,uuid,integer,integer,integer,integer) from anon;
grant execute on function public.submit_active_recording_session(uuid,uuid,integer,integer,integer,integer) to authenticated;
