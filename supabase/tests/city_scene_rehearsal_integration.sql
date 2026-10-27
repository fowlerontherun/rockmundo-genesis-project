-- Rollback-only proof of verified band rehearsal scoring against the real
-- PostgreSQL function, event-cursor and personal-progress contracts.
-- ONLY run on an isolated fixture DB (never production).
begin;
do $$
declare
  v_city uuid:='20000000-0000-0000-0000-000000000001';
  v_user uuid:='10000000-0000-0000-0000-000000000001';
  v_profile uuid:='30000000-0000-0000-0000-000000000001';
  v_band uuid:=gen_random_uuid();
  v_room uuid:=gen_random_uuid();
  v_rehearsal uuid:=gen_random_uuid();
  v_daily uuid;
  v_weekly uuid;
  v_monthly uuid;
  v_batch jsonb;
  v_repeat jsonb;
  v_progress jsonb;
begin
  if (select count(*) from public.cities) <> 1
    or exists(select 1 from public.scene_challenge_cycles)
    or exists(select 1 from public.scene_contributions)
  then raise exception 'ISOLATED_REHEARSAL_TEST_ONLY';end if;

  insert into public.bands(id) values (v_band);
  insert into public.band_members(band_id,profile_id,member_status)
    values(v_band,v_profile,'active');
  insert into public.rehearsal_rooms(id,city_id) values(v_room,v_city);

  update public.scene_challenge_templates set enabled=true
  where action_type='rehearsal:completed';
  update public.scene_source_controls set enabled=true
  where action_type='rehearsal:completed';
  update public.scene_rollout_controls
  set scoring_enabled=true,cycle_generation_enabled=true where singleton;

  insert into public.scene_challenge_cycles(
    city_id,cadence,starts_at,ends_at,
    active_population_snapshot,theme_slug,target_total,status
  ) values (
    v_city,'daily',now()-interval '1 hour',now()+interval '1 hour',
    1,'test',1,'active'
  ) returning id into v_daily;

  insert into public.scene_challenge_cycles(
    city_id,cadence,starts_at,ends_at,
    active_population_snapshot,theme_slug,target_total,status
  ) values (
    v_city,'weekly',now()-interval '1 hour',now()+interval '1 hour',
    1,'test',1,'active'
  ) returning id into v_weekly;

  insert into public.scene_challenge_objectives(
    cycle_id,template_id,target_points,source_health_snapshot
  )
  select v_daily,id,1,'{"scoring_enabled":true}'::jsonb
  from public.scene_challenge_templates
  where action_type='rehearsal:completed' and cadence='daily';

  insert into public.scene_challenge_objectives(
    cycle_id,template_id,target_points,source_health_snapshot
  )
  select v_weekly,id,1,'{"scoring_enabled":true}'::jsonb
  from public.scene_challenge_templates
  where action_type='rehearsal:completed' and cadence='weekly';

  insert into public.band_rehearsals (
    id,band_id,rehearsal_room_id,payment_profile_id,scheduled_end,
    completed_at,status,xp_earned
  ) values (
    v_rehearsal,v_band,v_room,v_profile,
    now()-interval '30 minutes',now()-interval '20 minutes',
    'completed',100
  );

  -- Per-source kill switch must keep the batch cursor stationary, even
  -- when a fully eligible source event and active objectives already exist.
  update public.scene_source_controls
  set enabled=false where action_type='rehearsal:completed';
  v_batch:=private.process_scene_verified_rehearsal_batch(50);
  if (v_batch->>'disabled')::boolean is not true
    or (v_batch->>'events_processed')::int <> 0
  then raise exception 'DISABLED_REHEARSAL_QUEUE_PROCESSED_EVENT: %',v_batch;end if;
  if (private.preview_scene_verified_rehearsal_batch(50)->>'source_ready')::boolean
  then raise exception 'DISABLED_REHEARSAL_SOURCE_STILL_REPORTS_READY';end if;
  if exists(select 1 from public.scene_processor_cursors
    where source_key='verified_rehearsal') then
    raise exception 'DISABLED_REHEARSAL_CREATED_CURSOR';end if;
  if private.ingest_scene_verified_rehearsal(v_rehearsal) <> 0 then
    raise exception 'DISABLED_REHEARSAL_DIRECT_INGEST_CREDITED';end if;

  update public.scene_source_controls
  set enabled=true where action_type='rehearsal:completed';

  v_batch:=private.process_scene_verified_rehearsal_batch(50);
  if (v_batch->>'events_processed')::int <> 1
    or (v_batch->>'contributions_inserted')::int <> 2
  then raise exception 'REHEARSAL_CREDIT_FAILED: %',v_batch;end if;

  if (select count(*) from public.scene_contributions
    where source_event_id=v_rehearsal::text
      and source_type='verified_rehearsal' and account_id=v_user)<>2
  then raise exception 'EXPECTED_DAILY_AND_WEEKLY_REHEARSAL_CREDIT';end if;

  v_repeat:=private.process_scene_verified_rehearsal_batch(50);
  if (v_repeat->>'contributions_inserted')::int<>0
    or (v_repeat->>'events_processed')::int<>0
  then raise exception 'REHEARSAL_REPLAY_AWARDED_TWICE: %',v_repeat;end if;

  perform private.reconcile_scene_milestones(v_city);
  if (select count(*) from public.scene_milestones
    where cycle_id in(v_daily,v_weekly) and percent_threshold=100)<>2
  then raise exception 'REHEARSAL_SCENE_COMPLETION_FAILED';end if;

  perform set_config('request.jwt.claim.sub',v_user::text,true);
  v_progress:=public.get_my_city_scene_progress(v_city);
  if jsonb_array_length(v_progress->'cycles')<>2 then
    raise exception 'REHEARSAL_PRIVATE_PROGRESS_MISSING';end if;
  if exists(select 1 from public.scene_reward_grant_receipts)
    or exists(select 1 from public.scene_reward_claims)
  then raise exception 'REHEARSAL_ACCIDENTALLY_ISSUED_REWARDS';end if;

  -- Monthly scene source is a second independent switch. With the
  -- monthly gate OFF, the same verified event must NOT credit that cycle.
  update public.scene_challenge_templates set enabled=true
  where action_type='scene:verified_community';
  insert into public.scene_challenge_cycles(
    city_id,cadence,starts_at,ends_at,
    active_population_snapshot,theme_slug,target_total,status
  ) values(
    v_city,'monthly',now()-interval '1 hour',now()+interval '1 hour',
    1,'test',1,'active'
  ) returning id into v_monthly;

  insert into public.scene_challenge_objectives(
    cycle_id,template_id,target_points,source_health_snapshot
  )
  select v_monthly,id,1,'{"scoring_enabled":true}'::jsonb
  from public.scene_challenge_templates
  where cadence='monthly' and action_type='scene:verified_community';

  if private.ingest_scene_verified_rehearsal(v_rehearsal) <> 0 then
    raise exception 'DISABLED_MONTHLY_SOURCE_STILL_CREDITED';
  end if;
  update public.scene_source_controls set enabled=true
  where action_type='scene:verified_community';
  if private.ingest_scene_verified_rehearsal(v_rehearsal) <> 1 then
    raise exception 'MONTHLY_SOURCE_NOT_CREDITED_ON_REENABLE';
  end if;
  if (select count(*) from public.scene_contributions sc
    join public.scene_challenge_objectives o on o.id=sc.objective_id
    where o.cycle_id=v_monthly and sc.account_id=v_user) <> 1 then
    raise exception 'EXPECTED_ONE_MONTHLY_REHEARSAL_CREDIT';
  end if;

  raise notice 'City Scene rehearsal verified event, 2-period credit, deduplication, milestones and private totals passed';
end;
$$;
rollback;