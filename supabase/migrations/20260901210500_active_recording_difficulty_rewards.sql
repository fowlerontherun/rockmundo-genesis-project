-- Active Recording: persist earned polish to the recorded song and support five difficulty levels.

alter table public.active_recording_sessions
  add column if not exists difficulty_level integer not null default 2;

alter table public.active_recording_sessions
  drop constraint if exists active_recording_sessions_difficulty_level_check;

alter table public.active_recording_sessions
  add constraint active_recording_sessions_difficulty_level_check
  check (difficulty_level between 1 and 5);

alter table public.active_recording_sessions
  drop constraint if exists active_recording_sessions_quality_bonus_check;

alter table public.active_recording_sessions
  add constraint active_recording_sessions_quality_bonus_check
  check (quality_bonus between 0 and 5);

drop function if exists public.submit_active_recording_session(uuid,uuid,integer,integer,integer,integer);

create or replace function public.submit_active_recording_session(
  p_profile_id uuid,
  p_recording_session_id uuid,
  p_score integer,
  p_perfect_takes integer,
  p_good_takes integer,
  p_rough_takes integer,
  p_difficulty_level integer default 2
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
  v_total_takes integer;
  v_score integer;
  v_current_song_quality integer;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode='P0001';
  end if;

  if p_difficulty_level not between 1 and 5 then
    raise exception 'Active Recording difficulty must be between 1 and 5.' using errcode='P0001';
  end if;

  v_total_takes := coalesce(p_perfect_takes,0) + coalesce(p_good_takes,0) + coalesce(p_rough_takes,0);
  if v_total_takes <> 5 or least(p_perfect_takes,p_good_takes,p_rough_takes) < 0 then
    raise exception 'An Active Recording must contain exactly five kept takes.' using errcode='P0001';
  end if;

  -- Never trust the client supplied score. Rebuild it from the five server-validated grade counts.
  v_score := round((p_perfect_takes*100 + p_good_takes*80 + p_rough_takes*40) / 5.0);

  perform 1 from public.profiles where id=p_profile_id and user_id=v_user for update;
  if not found then
    raise exception 'This character is not available.' using errcode='P0001';
  end if;

  select * into v_session from public.recording_sessions where id=p_recording_session_id for update;
  if not found then
    raise exception 'Recording session not found.' using errcode='P0001';
  end if;
  if v_session.status <> 'completed' then
    raise exception 'Finish the recording session before polishing a take.' using errcode='P0001';
  end if;
  if coalesce(v_session.recording_version,'standard') <> 'standard' then
    raise exception 'Active Recording polish is currently available for standard recordings only.' using errcode='P0001';
  end if;
  if v_session.profile_id is distinct from p_profile_id and (v_session.band_id is null or not public._band_active_member(v_session.band_id,p_profile_id)) then
    raise exception 'You do not have access to this recording session.' using errcode='P0001';
  end if;
  if exists(select 1 from public.active_recording_sessions where recording_session_id=p_recording_session_id) then
    raise exception 'This recording has already had its Active Recording polish.' using errcode='P0001';
  end if;

  -- Higher levels only pay more when the player also produces a strong take score.
  v_bonus := case p_difficulty_level
    when 1 then case when v_score >= 70 then 1 else 0 end
    when 2 then case when v_score >= 90 then 2 when v_score >= 70 then 1 else 0 end
    when 3 then case when v_score >= 90 then 3 when v_score >= 80 then 2 when v_score >= 70 then 1 else 0 end
    when 4 then case when v_score >= 90 then 4 when v_score >= 80 then 3 when v_score >= 70 then 2 else 0 end
    when 5 then case when v_score >= 90 then 5 when v_score >= 80 then 4 when v_score >= 70 then 3 else 0 end
    else 0
  end;

  v_new_master := least(100, coalesce(v_session.final_master_quality, coalesce(v_session.source_song_quality,50)) + v_bonus);
  v_bonus := v_new_master - coalesce(v_session.final_master_quality, coalesce(v_session.source_song_quality,50));

  update public.recording_sessions
  set final_master_quality = v_new_master,
      quality_improvement = coalesce(quality_improvement,0) + v_bonus,
      session_data = coalesce(session_data,'{}'::jsonb) || jsonb_build_object(
        'active_recording_polish',
        jsonb_build_object(
          'score',v_score,
          'difficulty_level',p_difficulty_level,
          'quality_bonus',v_bonus,
          'applied_at',now()
        )
      ),
      updated_at = now()
  where id = p_recording_session_id;

  -- Recorded Songs currently displays songs.quality_score, so persist the earned recording polish there too.
  -- This restores the behaviour lost when the hardened RPC replaced the original implementation.
  if v_session.song_id is not null and v_bonus > 0 then
    select quality_score into v_current_song_quality from public.songs where id=v_session.song_id for update;
    update public.songs
    set quality_score = least(100, coalesce(v_current_song_quality,0) + v_bonus),
        updated_at = now()
    where id = v_session.song_id;
  end if;

  insert into public.active_recording_sessions(
    recording_session_id,profile_id,user_id,score,perfect_takes,good_takes,rough_takes,quality_bonus,difficulty_level
  ) values (
    p_recording_session_id,p_profile_id,v_user,v_score,p_perfect_takes,p_good_takes,p_rough_takes,v_bonus,p_difficulty_level
  );

  return jsonb_build_object(
    'awarded',true,
    'score',v_score,
    'difficulty_level',p_difficulty_level,
    'quality_bonus',v_bonus,
    'final_master_quality',v_new_master
  );
end;
$$;

revoke all on function public.submit_active_recording_session(uuid,uuid,integer,integer,integer,integer,integer) from public,anon;
grant execute on function public.submit_active_recording_session(uuid,uuid,integer,integer,integer,integer,integer) to authenticated;
