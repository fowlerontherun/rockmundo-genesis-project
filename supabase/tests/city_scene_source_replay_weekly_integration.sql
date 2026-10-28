-- Isolated database acceptance for late-arriving gig, recording and
-- rehearsal results that fall behind the normal forward-only event cursor.
-- All fixtures and control changes end in ROLLBACK.
begin;
do $$
declare
  v_city uuid := '20000000-0000-0000-0000-000000000001';
  v_profile uuid := '30000000-0000-0000-0000-000000000001';
  v_user uuid := '10000000-0000-0000-0000-000000000001';
  v_band uuid := gen_random_uuid();
  v_venue uuid := gen_random_uuid();
  v_room uuid := gen_random_uuid();
  v_gig_new uuid := gen_random_uuid();
  v_gig_late uuid := gen_random_uuid();
  v_outcome_new uuid := gen_random_uuid();
  v_outcome_late uuid := gen_random_uuid();
  v_recording_new uuid := gen_random_uuid();
  v_recording_late uuid := gen_random_uuid();
  v_rehearsal_new uuid := gen_random_uuid();
  v_rehearsal_late uuid := gen_random_uuid();
  v_cycle uuid;
  v_at_new timestamptz := now()-interval '35 minutes';
  v_at_late timestamptz := now()-interval '2 hours';
  v_r jsonb;
begin
  if (select count(*) from public.cities)<>1
     or exists(select 1 from public.scene_challenge_cycles)
     or exists(select 1 from public.scene_contributions)
  then raise exception 'SCENE_REPLAY_DISPOSABLE_FIXTURE_REQUIRED'; end if;

  if has_function_privilege('authenticated',
    'private.scene_replay_recent_verified_sources(integer)','EXECUTE')
    or has_function_privilege('anon',
    'private.scene_replay_recent_verified_sources(integer)','EXECUTE')
    or has_table_privilege('authenticated',
    'public.scene_source_replay_controls','UPDATE')
  then raise exception 'SCENE_REPLAY_EXPOSED_TO_PLAYER'; end if;

  update public.scene_challenge_templates set enabled=true
    where action_type in ('gig:verified_performance',
       'recording:completed','rehearsal:completed');
  update public.scene_rollout_controls
    set scoring_enabled=true where singleton=true;
  update public.scene_source_controls set enabled=true
    where action_type in ('gig:verified_performance',
       'recording:completed','rehearsal:completed');

  insert into public.scene_challenge_cycles(
    city_id,cadence,starts_at,ends_at,
    active_population_snapshot,theme_slug,target_total,status
  ) values(v_city,'weekly',now()-interval '4 hours',now()+interval '4 hours',
    1,'late-event-replay-fixture',6,'active')
  returning id into v_cycle;

  insert into public.scene_challenge_objectives(
    cycle_id,template_id,target_points,source_health_snapshot
  )
  select v_cycle,t.id,2,
    jsonb_build_object('scoring_enabled',true,'adapter',t.action_type)
  from public.scene_challenge_templates t
  where t.enabled and t.cadence='weekly'
    and t.action_type in (
      'gig:verified_performance','recording:completed','rehearsal:completed'
    );

  if (select count(*) from public.scene_challenge_objectives
      where cycle_id=v_cycle)<>3
  then raise exception 'MISSING_SCENE_REPLAY_SOURCE_OBJECTIVES';end if;

  insert into public.bands(id) values(v_band);
  insert into public.band_members(band_id,profile_id,member_status)
    values(v_band,v_profile,'active');
  insert into public.venues(id,city_id) values(v_venue,v_city);
  insert into public.rehearsal_rooms(id,city_id) values(v_room,v_city);

  insert into public.gigs(id,band_id,venue_id,status)
  values(v_gig_new,v_band,v_venue,'completed'),
        (v_gig_late,v_band,v_venue,'completed');
  insert into public.gig_outcomes(id,gig_id,band_id,completed_at)
  values(v_outcome_new,v_gig_new,v_band,v_at_new);
  insert into public.gig_performers(
    gig_id,band_id,profile_id,lineup_status,performed_at
  ) values(v_gig_new,v_band,v_profile,'performed',v_at_new-interval '5 minutes');

  insert into public.recording_sessions(
    id,status,profile_id,user_id,city_id,band_id,
    scheduled_end,completed_at,updated_at,xp_awards
  ) values(v_recording_new,'completed',v_profile,v_user,v_city,v_band,
    v_at_new-interval '10 minutes',v_at_new,v_at_new,'{"session":8}'::jsonb);

  insert into public.band_rehearsals(
    id,band_id,rehearsal_room_id,payment_profile_id,
    scheduled_end,completed_at,status,xp_earned
  ) values(v_rehearsal_new,v_band,v_room,v_profile,
    v_at_new-interval '10 minutes',v_at_new,'completed',25);

  -- First normal forward-only pass sets each source's high-water mark.
  perform private.process_scene_verified_gig_batch(25);
  perform private.process_scene_completed_recording_batch(25);
  perform private.process_scene_verified_rehearsal_batch(25);
  if (select count(*) from public.scene_contributions
    where invalidated_at is null)<>3
  then raise exception 'SCENE_FORWARD_CURSOR_FIXTURE_DID_NOT_SCORE';end if;

  -- Materialise older results AFTER the newer events were processed.
  -- Normal cursors cannot go backwards and therefore miss these.
  insert into public.gig_outcomes(id,gig_id,band_id,completed_at)
  values(v_outcome_late,v_gig_late,v_band,v_at_late);
  insert into public.gig_performers(
    gig_id,band_id,profile_id,lineup_status,performed_at
  ) values(v_gig_late,v_band,v_profile,'performed',
    v_at_late-interval '5 minutes');

  insert into public.recording_sessions(
    id,status,profile_id,user_id,city_id,band_id,
    scheduled_end,completed_at,updated_at,xp_awards
  ) values(v_recording_late,'completed',v_profile,v_user,v_city,v_band,
    v_at_late-interval '10 minutes',v_at_late,v_at_late,'{"session":8}'::jsonb);

  insert into public.band_rehearsals(
    id,band_id,rehearsal_room_id,payment_profile_id,
    scheduled_end,completed_at,status,xp_earned
  ) values(v_rehearsal_late,v_band,v_room,v_profile,
    v_at_late-interval '10 minutes',v_at_late,'completed',25);

  perform private.process_scene_verified_gig_batch(25);
  perform private.process_scene_completed_recording_batch(25);
  perform private.process_scene_verified_rehearsal_batch(25);
  if (select count(*) from public.scene_contributions)<>3
  then raise exception 'FORWARD_CURSOR_DID_NOT_REPRODUCE_MISSED_EVENTS';end if;

  -- Defaults to disabled. Do not mutate the cursors or player credit.
  v_r:=private.scene_replay_recent_verified_sources(25);
  if (v_r->>'disabled')::boolean is not true
    or (select count(*) from public.scene_contributions)<>3
  then raise exception 'DISABLED_REPLAY_MUTATED_SCENE: %',v_r;end if;

  update public.scene_source_replay_controls set enabled=true
    where singleton=true;
  v_r:=private.scene_replay_recent_verified_sources(25);
  if (v_r->>'disabled')::boolean is true
    or (v_r->>'contributions_recovered')::int<>3
    or (v_r->>'events_rechecked')::int<>6
    or (select count(*) from public.scene_contributions)<>6
  then raise exception 'LATE_SCENE_SOURCE_REPLAY_FAILED: %',v_r;end if;

  if (select count(distinct source_type) from public.scene_contributions)<>3
  then raise exception 'NOT_ALL_TRUSTED_SOURCES_RECOVERED';end if;

  -- The cursor cooldown avoids repeated scans on the next 15-minute tick.
  v_r:=private.scene_replay_recent_verified_sources(25);
  if (v_r->>'events_rechecked')::int<>0 or
     (v_r->>'contributions_recovered')::int<>0
  then raise exception 'REPLAY_COOLDOWN_FAILED: %',v_r;end if;

  -- Restarting the one-hour sweep must never duplicate any score.
  update public.scene_source_replay_cursors set next_scan_at=now()-interval '1 minute';
  v_r:=private.scene_replay_recent_verified_sources(25);
  if (v_r->>'events_rechecked')::int<>6
    or (v_r->>'contributions_recovered')::int<>0
    or (select count(*) from public.scene_contributions)<>6
  then raise exception 'SECOND_SCENE_SOURCE_REPLAY_AWARDED_TWICE: %',v_r;end if;

  -- Source-specific kill switch must still block the replay.
  update public.scene_source_controls set enabled=false
    where action_type='gig:verified_performance';
  update public.scene_source_replay_cursors set next_scan_at=now()-interval '1 minute';
  v_r:=private.scene_replay_recent_verified_sources(25);
  if (v_r->>'events_rechecked')::int<>4
    or (v_r->>'contributions_recovered')::int<>0
  then raise exception 'SOURCE_KILL_SWITCH_NOT_APPLIED_TO_REPLAY: %',v_r;end if;

  if exists(select 1 from public.scene_reward_grant_receipts)
    or exists(select 1 from public.scene_reward_claims)
  then raise exception 'SCENE_REPLAY_ISSUED_REWARD';end if;

  raise notice 'City Scene 3-source seven-day backfill, kill-switch and replay idempotency passed';
end;
$$;
rollback;
