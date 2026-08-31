-- Active Sessions Phase 6: make rewards server-authoritative and close retry/concurrency gaps.

create or replace function public.submit_active_practice_session(
  p_profile_id uuid,p_instrument_slug text,p_song_id uuid,p_song_title text,p_level_reached integer,p_score integer,p_longest_combo integer,p_notes_hit integer,p_notes_missed integer
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid:=auth.uid(); v_sessions_today integer:=0; v_xp_today integer:=0; v_accuracy integer; v_level integer;
  v_base integer:=25; v_level_bonus integer; v_accuracy_bonus integer; v_combo_bonus integer; v_total integer; v_factor numeric:=1; v_awarded integer;
  v_skill public.skill_progress%rowtype; v_new_xp integer; v_required integer; v_new_level integer; v_difficulty text;
begin
  if v_user is null then raise exception 'Not authenticated' using errcode='P0001'; end if;
  if p_instrument_slug not in ('guitar','bass','drums','vocals','basic_keyboard','basic_strings','basic_percussions','basic_electronic_instruments') then raise exception 'Unsupported practice instrument.' using errcode='P0001'; end if;
  if coalesce(p_notes_hit,0)<0 or coalesce(p_notes_missed,0)<0 or coalesce(p_longest_combo,0)<0 then raise exception 'Invalid practice result.' using errcode='P0001'; end if;
  if coalesce(p_notes_hit,0)+coalesce(p_notes_missed,0)=0 then raise exception 'No scored notes were recorded.' using errcode='P0001'; end if;
  if p_longest_combo>p_notes_hit then raise exception 'Combo cannot exceed notes hit.' using errcode='P0001'; end if;
  perform 1 from public.profiles where id=p_profile_id and user_id=v_user for update;
  if not found then raise exception 'This character is not available.' using errcode='P0001'; end if;
  v_level:=greatest(1,least(coalesce(p_level_reached,1),floor(coalesce(p_notes_hit,0)/8.0)::integer+1));
  v_accuracy:=round((p_notes_hit::numeric/greatest(1,p_notes_hit+p_notes_missed))*100)::integer;
  select count(*),coalesce(sum(xp_earned),0) into v_sessions_today,v_xp_today from public.stage_practice_sessions where profile_id=p_profile_id and played_at>=date_trunc('day',now());
  v_level_bonus:=v_level*12; v_accuracy_bonus:=round(v_accuracy*0.6); v_combo_bonus:=round(p_longest_combo*0.5); v_total:=v_base+v_level_bonus+v_accuracy_bonus+v_combo_bonus;
  if v_sessions_today>=4 then v_factor:=greatest(0.2,1-((v_sessions_today-4)*0.25)); v_total:=round(v_total*v_factor); end if;
  v_awarded:=greatest(0,least(v_total,750-v_xp_today));
  select * into v_skill from public.skill_progress where profile_id=p_profile_id and skill_slug=p_instrument_slug for update;
  if found then
    v_new_xp:=coalesce(v_skill.current_xp,0)+v_awarded; v_required:=greatest(1,coalesce(v_skill.required_xp,100)); v_new_level:=coalesce(v_skill.current_level,0);
    while v_new_xp>=v_required loop v_new_xp:=v_new_xp-v_required; v_new_level:=v_new_level+1; v_required:=round(v_required*1.15); end loop;
    update public.skill_progress set current_xp=v_new_xp,current_level=v_new_level,required_xp=v_required,last_practiced_at=now(),updated_at=now() where id=v_skill.id;
  end if;
  select case when coalesce(current_level,0)<=3 then 'beginner' when coalesce(current_level,0)<=8 then 'intermediate' when coalesce(current_level,0)<=14 then 'advanced' else 'master' end into v_difficulty from public.skill_progress where profile_id=p_profile_id and skill_slug=p_instrument_slug;
  v_difficulty:=coalesce(v_difficulty,'beginner');
  insert into public.stage_practice_sessions(user_id,profile_id,instrument_slug,song_id,song_title,level_reached,score,accuracy_pct,longest_combo,notes_hit,notes_missed,xp_earned,difficulty)
  values(v_user,p_profile_id,p_instrument_slug,p_song_id,coalesce(nullif(trim(p_song_title),''),'Practice Track'),v_level,greatest(0,coalesce(p_score,0)),v_accuracy,p_longest_combo,p_notes_hit,p_notes_missed,v_awarded,v_difficulty);
  return jsonb_build_object('awarded',true,'sessions_today',v_sessions_today+1,'xp_today',v_xp_today+v_awarded,'base_xp',v_base,'level_bonus',v_level_bonus,'accuracy_bonus',v_accuracy_bonus,'combo_bonus',v_combo_bonus,'total_xp',v_total,'actual_xp_awarded',v_awarded,'accuracy',v_accuracy,'level_reached',v_level,'diminishing',v_factor<1,'daily_cap_hit',v_awarded<v_total);
end;$$;
revoke all on function public.submit_active_practice_session(uuid,text,uuid,text,integer,integer,integer,integer,integer) from public,anon;
grant execute on function public.submit_active_practice_session(uuid,text,uuid,text,integer,integer,integer,integer,integer) to authenticated;
revoke insert,update,delete on public.stage_practice_sessions from authenticated,anon;

create or replace function public.submit_active_songwriting_answers(p_profile_id uuid,p_project_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid:=auth.uid(); v_project public.songwriting_projects%rowtype; v_sessions_today integer:=0; v_factor numeric:=1;
  v_lyrics integer:=0; v_chords integer:=0; v_melody integer:=0; v_arrangement integer:=0; v_overall integer;
  v_music_strength numeric; v_lyrics_strength numeric; v_music integer; v_lyric_gain integer; v_new_music integer; v_new_lyrics integer;
  v_answers jsonb:=jsonb_build_object('lyrics-1','turn I take','lyrics-2','name again','lyrics-3','The ceiling counts the hours I can''t spend','chords-1','C','chords-2','C','chords-3','G','melody-1','1','melody-2','3','melody-3','Move the melody higher and widen the intervals','arrangement-1','Drop instruments before the chorus, then bring the full band back','arrangement-2','Add harmonies and an extra guitar/keyboard layer','arrangement-3','Thin out competing parts around the vocal');
  v_id text; v_answer text;
begin
  if v_user is null then raise exception 'Not authenticated' using errcode='P0001'; end if;
  perform 1 from public.profiles where id=p_profile_id and user_id=v_user for update;
  if not found then raise exception 'This character is not available.' using errcode='P0001'; end if;
  select * into v_project from public.songwriting_projects where id=p_project_id for update;
  if not found then raise exception 'The songwriting project is no longer available.' using errcode='P0001'; end if;
  if v_project.profile_id is distinct from p_profile_id then raise exception 'This project belongs to another character.' using errcode='P0001'; end if;
  if v_project.status in ('completed','complete','converted') or v_project.song_id is not null then raise exception 'This song is already complete.' using errcode='P0001'; end if;
  if v_project.locked_until is not null and v_project.locked_until>now() then raise exception 'Finish the current songwriting session before starting Active Writing on this song.' using errcode='P0001'; end if;
  if jsonb_typeof(p_answers)<>'object' then raise exception 'Invalid songwriting answers.' using errcode='P0001'; end if;
  foreach v_id in array array['lyrics','chords','melody','arrangement'] loop if jsonb_typeof(p_answers->v_id)<>'object' then raise exception 'All four puzzle answers are required.' using errcode='P0001'; end if; end loop;
  v_id:=p_answers#>>'{lyrics,id}'; v_answer:=p_answers#>>'{lyrics,answer}'; if v_id like 'lyrics-%' and v_answers->>v_id=v_answer then v_lyrics:=100; end if;
  v_id:=p_answers#>>'{chords,id}'; v_answer:=p_answers#>>'{chords,answer}'; if v_id like 'chords-%' and v_answers->>v_id=v_answer then v_chords:=100; end if;
  v_id:=p_answers#>>'{melody,id}'; v_answer:=p_answers#>>'{melody,answer}'; if v_id like 'melody-%' and v_answers->>v_id=v_answer then v_melody:=100; end if;
  v_id:=p_answers#>>'{arrangement,id}'; v_answer:=p_answers#>>'{arrangement,answer}'; if v_id like 'arrangement-%' and v_answers->>v_id=v_answer then v_arrangement:=100; end if;
  select count(*) into v_sessions_today from public.active_songwriting_sessions where profile_id=p_profile_id and played_at>=date_trunc('day',now());
  v_overall:=round((v_lyrics+v_chords+v_melody+v_arrangement)/4.0);
  if v_sessions_today>=12 then return jsonb_build_object('awarded',false,'reason','daily_cap','sessions_today',v_sessions_today,'overall_score',v_overall,'music_progress_gained',0,'lyrics_progress_gained',0); end if;
  if v_sessions_today>=8 then v_factor:=0.25; elsif v_sessions_today>=4 then v_factor:=0.5; end if;
  v_music_strength:=(v_chords+v_melody+v_arrangement)/3.0; v_lyrics_strength:=(v_lyrics+v_arrangement)/2.0;
  v_music:=greatest(1,round((4+v_music_strength*0.10)*v_factor)); v_lyric_gain:=greatest(1,round((3+v_lyrics_strength*0.08)*v_factor));
  v_new_music:=least(2000,coalesce(v_project.music_progress,0)+v_music); v_new_lyrics:=least(2000,coalesce(v_project.lyrics_progress,0)+v_lyric_gain);
  v_music:=v_new_music-coalesce(v_project.music_progress,0); v_lyric_gain:=v_new_lyrics-coalesce(v_project.lyrics_progress,0);
  update public.songwriting_projects set music_progress=v_new_music,lyrics_progress=v_new_lyrics,updated_at=now() where id=p_project_id;
  insert into public.active_songwriting_sessions(profile_id,project_id,user_id,score,score_breakdown,music_progress_gained,lyrics_progress_gained) values(p_profile_id,p_project_id,v_user,v_overall,jsonb_build_object('lyrics',v_lyrics,'chords',v_chords,'melody',v_melody,'arrangement',v_arrangement),v_music,v_lyric_gain);
  return jsonb_build_object('awarded',true,'sessions_today',v_sessions_today+1,'diminishing',v_factor<1,'factor',v_factor,'overall_score',v_overall,'music_progress_gained',v_music,'lyrics_progress_gained',v_lyric_gain,'music_progress',v_new_music,'lyrics_progress',v_new_lyrics);
end;$$;
revoke all on function public.submit_active_songwriting_answers(uuid,uuid,jsonb) from public,anon;
grant execute on function public.submit_active_songwriting_answers(uuid,uuid,jsonb) to authenticated;
revoke execute on function public.submit_active_songwriting_session(uuid,uuid,integer,integer,integer,integer) from authenticated,anon,public;

create or replace function public.submit_active_rehearsal_session(p_profile_id uuid,p_band_id uuid,p_song_id uuid,p_score integer,p_perfect_hits integer,p_tight_hits integer,p_recovery_hits integer,p_lost_hits integer)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid:=auth.uid(); v_sessions_today integer:=0; v_factor numeric:=1; v_minutes integer:=0; v_cohesion integer:=0; v_current_minutes integer:=0; v_new_minutes integer:=0; v_percentage integer:=0; v_total_hits integer; v_score integer;
begin
  if v_user is null then raise exception 'Not authenticated' using errcode='P0001'; end if;
  v_total_hits:=coalesce(p_perfect_hits,0)+coalesce(p_tight_hits,0)+coalesce(p_recovery_hits,0)+coalesce(p_lost_hits,0);
  if v_total_hits<>12 or least(p_perfect_hits,p_tight_hits,p_recovery_hits,p_lost_hits)<0 then raise exception 'A rehearsal session must contain exactly 12 scored beats.' using errcode='P0001'; end if;
  v_score:=round((p_perfect_hits*100+p_tight_hits*80+p_recovery_hits*55+p_lost_hits*20)/12.0);
  perform 1 from public.profiles where id=p_profile_id and user_id=v_user for update; if not found then raise exception 'This character is not available.' using errcode='P0001'; end if;
  if not public._band_active_member(p_band_id,p_profile_id) then raise exception 'You must be an active member of this band.' using errcode='P0001'; end if;
  if not exists(select 1 from public.songs s where s.id=p_song_id and (s.band_id=p_band_id or s.profile_id=p_profile_id) and coalesce(s.archived,false)=false) then raise exception 'This song is not available to rehearse.' using errcode='P0001'; end if;
  select count(*) into v_sessions_today from public.active_rehearsal_sessions where profile_id=p_profile_id and played_at>=date_trunc('day',now());
  if v_sessions_today>=10 then return jsonb_build_object('awarded',false,'reason','daily_cap','sessions_today',v_sessions_today,'familiarity_minutes_gained',0,'cohesion_gained',0,'score',v_score); end if;
  if v_sessions_today>=7 then v_factor:=0.25; elsif v_sessions_today>=4 then v_factor:=0.5; end if;
  v_minutes:=greatest(1,round((2+v_score*0.08)*v_factor)); if v_score>=85 and v_sessions_today<2 then v_cohesion:=1; end if;
  select familiarity_minutes into v_current_minutes from public.band_song_familiarity where band_id=p_band_id and song_id=p_song_id for update;
  v_current_minutes:=coalesce(v_current_minutes,0); v_new_minutes:=least(360,v_current_minutes+v_minutes); v_minutes:=v_new_minutes-v_current_minutes; v_percentage:=least(100,round((v_new_minutes/360.0)*100));
  insert into public.band_song_familiarity(band_id,song_id,familiarity_minutes,familiarity_percentage,last_rehearsed_at,updated_at) values(p_band_id,p_song_id,v_new_minutes,v_percentage,now(),now()) on conflict(band_id,song_id) do update set familiarity_minutes=excluded.familiarity_minutes,familiarity_percentage=excluded.familiarity_percentage,last_rehearsed_at=excluded.last_rehearsed_at,updated_at=excluded.updated_at;
  if v_cohesion>0 then update public.bands set cohesion_score=least(100,coalesce(cohesion_score,0)+v_cohesion),updated_at=now() where id=p_band_id; end if;
  insert into public.active_rehearsal_sessions(profile_id,band_id,song_id,user_id,score,perfect_hits,tight_hits,recovery_hits,lost_hits,familiarity_minutes_gained,cohesion_gained) values(p_profile_id,p_band_id,p_song_id,v_user,v_score,p_perfect_hits,p_tight_hits,p_recovery_hits,p_lost_hits,v_minutes,v_cohesion);
  return jsonb_build_object('awarded',true,'sessions_today',v_sessions_today+1,'diminishing',v_factor<1,'factor',v_factor,'score',v_score,'familiarity_minutes_gained',v_minutes,'familiarity_minutes',v_new_minutes,'familiarity_percentage',v_percentage,'cohesion_gained',v_cohesion);
end;$$;

create or replace function public.submit_active_recording_session(p_profile_id uuid,p_recording_session_id uuid,p_score integer,p_perfect_takes integer,p_good_takes integer,p_rough_takes integer)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_session public.recording_sessions%rowtype; v_bonus integer:=0; v_new_master integer; v_total_takes integer; v_score integer;
begin
  if v_user is null then raise exception 'Not authenticated' using errcode='P0001'; end if;
  v_total_takes:=coalesce(p_perfect_takes,0)+coalesce(p_good_takes,0)+coalesce(p_rough_takes,0); if v_total_takes<>5 or least(p_perfect_takes,p_good_takes,p_rough_takes)<0 then raise exception 'An Active Recording must contain exactly five kept takes.' using errcode='P0001'; end if;
  v_score:=round((p_perfect_takes*100+p_good_takes*80+p_rough_takes*40)/5.0);
  perform 1 from public.profiles where id=p_profile_id and user_id=v_user for update; if not found then raise exception 'This character is not available.' using errcode='P0001'; end if;
  select * into v_session from public.recording_sessions where id=p_recording_session_id for update; if not found then raise exception 'Recording session not found.' using errcode='P0001'; end if;
  if v_session.status<>'completed' then raise exception 'Finish the recording session before polishing a take.' using errcode='P0001'; end if;
  if coalesce(v_session.recording_version,'standard')<>'standard' then raise exception 'Active Recording polish is currently available for standard recordings only.' using errcode='P0001'; end if;
  if v_session.profile_id is distinct from p_profile_id and (v_session.band_id is null or not public._band_active_member(v_session.band_id,p_profile_id)) then raise exception 'You do not have access to this recording session.' using errcode='P0001'; end if;
  if exists(select 1 from public.active_recording_sessions where recording_session_id=p_recording_session_id) then raise exception 'This recording has already had its Active Recording polish.' using errcode='P0001'; end if;
  if v_score>=90 then v_bonus:=2; elsif v_score>=70 then v_bonus:=1; end if;
  v_new_master:=least(100,coalesce(v_session.final_master_quality,coalesce(v_session.source_song_quality,50))+v_bonus); v_bonus:=v_new_master-coalesce(v_session.final_master_quality,coalesce(v_session.source_song_quality,50));
  update public.recording_sessions set final_master_quality=v_new_master,quality_improvement=coalesce(quality_improvement,0)+v_bonus,session_data=coalesce(session_data,'{}'::jsonb)||jsonb_build_object('active_recording_polish',jsonb_build_object('score',v_score,'quality_bonus',v_bonus,'applied_at',now())),updated_at=now() where id=p_recording_session_id;
  insert into public.active_recording_sessions(recording_session_id,profile_id,user_id,score,perfect_takes,good_takes,rough_takes,quality_bonus) values(p_recording_session_id,p_profile_id,v_user,v_score,p_perfect_takes,p_good_takes,p_rough_takes,v_bonus);
  return jsonb_build_object('awarded',true,'score',v_score,'quality_bonus',v_bonus,'final_master_quality',v_new_master);
end;$$;

drop policy if exists "active recording sessions own select" on public.active_recording_sessions;
create policy "active recording sessions authorised select" on public.active_recording_sessions for select to authenticated using (user_id=auth.uid() or exists(select 1 from public.recording_sessions r join public.profiles p on p.user_id=auth.uid() where r.id=active_recording_sessions.recording_session_id and (r.profile_id=p.id or (r.band_id is not null and public._band_active_member(r.band_id,p.id)))));

alter table public.active_gig_performance_sessions add column if not exists status text not null default 'completed';
alter table public.active_gig_performance_sessions add column if not exists challenge jsonb;
alter table public.active_gig_performance_sessions add column if not exists started_at timestamptz not null default now();
alter table public.active_gig_performance_sessions add column if not exists completed_at timestamptz;
update public.active_gig_performance_sessions set completed_at=coalesce(completed_at,played_at),status='completed' where status='completed';

create or replace function public.begin_active_gig_performance(p_profile_id uuid,p_gig_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid:=auth.uid(); v_gig public.gigs%rowtype; v_existing public.active_gig_performance_sessions%rowtype; v_challenge jsonb:='[]'::jsonb; v_round jsonb; v_len integer; i integer; j integer; v_zone text; v_previous text;
begin
  if v_user is null then raise exception 'Not authenticated' using errcode='P0001'; end if;
  if not exists(select 1 from public.profiles where id=p_profile_id and user_id=v_user) then raise exception 'This character is not available.' using errcode='P0001'; end if;
  select * into v_gig from public.gigs where id=p_gig_id for update; if not found then raise exception 'Gig not found.' using errcode='P0001'; end if;
  if v_gig.started_at is null or v_gig.status in ('completed','cancelled','failed') or v_gig.result_ready_at is not null then raise exception 'Active Performance is only available while this gig is live.' using errcode='P0001'; end if;
  if not public._band_active_member(v_gig.band_id,p_profile_id) then raise exception 'You must be an active member of the performing band.' using errcode='P0001'; end if;
  select * into v_existing from public.active_gig_performance_sessions where gig_id=p_gig_id and profile_id=p_profile_id for update;
  if found then if v_existing.status='started' then return jsonb_build_object('challenge',v_existing.challenge,'started',true,'resumed',true); end if; raise exception 'This character has already completed Active Performance for this gig.' using errcode='P0001'; end if;
  for i in 1..5 loop
    v_len:=case i when 1 then 2 when 2 then 3 when 3 then 3 when 4 then 4 else 5 end; v_round:='[]'::jsonb; v_previous:=null;
    for j in 1..v_len loop loop v_zone:=(array['LEFT','CENTRE','RIGHT','FRONT'])[1+floor(random()*4)::integer]; exit when v_previous is null or v_zone<>v_previous; end loop; v_round:=v_round||to_jsonb(v_zone); v_previous:=v_zone; end loop;
    v_challenge:=v_challenge||jsonb_build_array(v_round);
  end loop;
  insert into public.active_gig_performance_sessions(gig_id,band_id,profile_id,user_id,cue_scores,score,rating_multiplier,status,challenge,started_at,played_at) values(p_gig_id,v_gig.band_id,p_profile_id,v_user,array[0,0,0,0,0],0,0,'started',v_challenge,now(),now());
  return jsonb_build_object('challenge',v_challenge,'started',true,'resumed',false);
end;$$;
revoke all on function public.begin_active_gig_performance(uuid,uuid) from public,anon; grant execute on function public.begin_active_gig_performance(uuid,uuid) to authenticated;

create or replace function public.submit_active_gig_performance_v2(p_profile_id uuid,p_gig_id uuid,p_responses jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid:=auth.uid(); v_gig public.gigs%rowtype; v_session public.active_gig_performance_sessions%rowtype; v_scores integer[]:=array[]::integer[]; v_score integer; v_multiplier numeric(6,4):=0; v_old_best numeric(6,4):=0; v_new_best numeric(6,4):=0; i integer; j integer; v_expected jsonb; v_response jsonb; v_len integer; v_correct integer; v_cue integer;
begin
  if v_user is null then raise exception 'Not authenticated' using errcode='P0001'; end if;
  if not exists(select 1 from public.profiles where id=p_profile_id and user_id=v_user) then raise exception 'This character is not available.' using errcode='P0001'; end if;
  select * into v_gig from public.gigs where id=p_gig_id for update; if not found then raise exception 'Gig not found.' using errcode='P0001'; end if;
  if v_gig.started_at is null or v_gig.status in ('completed','cancelled','failed') or v_gig.result_ready_at is not null then raise exception 'Active Performance is only available while this gig is live.' using errcode='P0001'; end if;
  select * into v_session from public.active_gig_performance_sessions where gig_id=p_gig_id and profile_id=p_profile_id for update; if not found or v_session.status<>'started' then raise exception 'Start Active Performance before submitting it.' using errcode='P0001'; end if;
  if jsonb_typeof(p_responses)<>'array' or jsonb_array_length(p_responses)<>5 then raise exception 'Five crowd cue responses are required.' using errcode='P0001'; end if;
  for i in 0..4 loop
    v_expected:=v_session.challenge->i; v_response:=p_responses->i; if jsonb_typeof(v_response)<>'array' or jsonb_array_length(v_response)<>jsonb_array_length(v_expected) then raise exception 'Crowd cue response length does not match the challenge.' using errcode='P0001'; end if;
    v_len:=jsonb_array_length(v_expected); v_correct:=0; for j in 0..v_len-1 loop if v_response->>j=v_expected->>j then v_correct:=v_correct+1; end if; end loop; v_cue:=greatest(20,round((v_correct::numeric/v_len)*100)); v_scores:=array_append(v_scores,v_cue);
  end loop;
  select coalesce(max(rating_multiplier),0) into v_old_best from public.active_gig_performance_sessions where gig_id=p_gig_id and status='completed'; select round(avg(v))::integer into v_score from unnest(v_scores) v;
  if v_score>=90 then v_multiplier:=0.015; elsif v_score>=75 then v_multiplier:=0.010; elsif v_score>=60 then v_multiplier:=0.005; end if;
  update public.active_gig_performance_sessions set cue_scores=v_scores,score=v_score,rating_multiplier=v_multiplier,status='completed',completed_at=now(),played_at=now() where id=v_session.id;
  select coalesce(max(rating_multiplier),0) into v_new_best from public.active_gig_performance_sessions where gig_id=p_gig_id and status='completed';
  if v_new_best>v_old_best then update public.gig_song_performances p set performance_score=least(25::numeric,round(coalesce(p.performance_score,0)*((1+v_new_best)/(1+v_old_best)),2)) where p.gig_outcome_id in(select o.id from public.gig_outcomes o where o.gig_id=p_gig_id); end if;
  return jsonb_build_object('awarded',true,'score',v_score,'cue_scores',to_jsonb(v_scores),'rating_multiplier',v_multiplier,'band_best_multiplier',v_new_best);
end;$$;
revoke all on function public.submit_active_gig_performance_v2(uuid,uuid,jsonb) from public,anon; grant execute on function public.submit_active_gig_performance_v2(uuid,uuid,jsonb) to authenticated;
revoke execute on function public.submit_active_gig_performance(uuid,uuid,integer[]) from authenticated,anon,public;
