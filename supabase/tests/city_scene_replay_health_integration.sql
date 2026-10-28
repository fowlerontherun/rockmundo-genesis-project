-- Rollback-only City Scene replay health monitoring integration.
-- Must run in isolated PostgreSQL CI, never against production.
begin;
do $$
declare v jsonb; v_denied boolean:=false;
begin
  if exists(select 1 from public.scene_source_replay_cursors)
  then raise exception 'REPLAY_HEALTH_TEST_NEEDS_EMPTY_FIXTURE';end if;
  if has_function_privilege('anon',
    'private.scene_replay_health_snapshot(integer)','EXECUTE')
     or has_function_privilege('authenticated',
    'private.scene_replay_health_snapshot(integer)','EXECUTE')
     or not has_function_privilege('service_role',
    'private.scene_replay_health_snapshot(integer)','EXECUTE')
  then raise exception 'REPLAY_HEALTH_CLIENT_PRIVILEGE_LEAK';end if;

  v:=private.scene_replay_health_snapshot(30);
  if v->>'status'<>'disabled' or (v->>'needs_attention')::boolean is true
  then raise exception 'DEFAULT_REPLAY_HEALTH_STATUS_WRONG: %',v;end if;

  update public.scene_rollout_controls set scoring_enabled=true where singleton;
  update public.scene_source_replay_controls set enabled=true where singleton;
  v:=private.scene_replay_health_snapshot(30);
  if v->>'status'<>'waiting_initial_sweep'
    or (v->>'needs_attention')::boolean is not true
  then raise exception 'HEALTH_DID_NOT_DETECT_MISSING_CURSORS: %',v;end if;

  insert into public.scene_source_replay_cursors(
    source_key,cursor_at,next_scan_at,last_sweep_at,events_rechecked,
    contributions_recovered
  ) values
    ('verified_gig',now()-interval '7 days',now()+interval '30 minutes',now(),3,1),
    ('completed_recording',now()-interval '7 days',now()+interval '30 minutes',now(),4,0),
    ('verified_rehearsal',now()-interval '7 days',now()+interval '30 minutes',now(),5,0);
  v:=private.scene_replay_health_snapshot(30);
  if v->>'status'<>'healthy'
    or (v->>'needs_attention')::boolean is true
    or (v->>'events_rechecked_total')::integer<>12
    or (v->>'contributions_recovered_total')::integer<>1
    or jsonb_array_length(v->'sources')<>3
  then raise exception 'HEALTHY_REPLAY_HEALTH_INCORRECT: %',v;end if;

  update public.scene_source_replay_cursors
    set next_scan_at=now()-interval '35 minutes'
    where source_key='verified_rehearsal';
  v:=private.scene_replay_health_snapshot(30);
  if v->>'status'<>'stalled'
    or (v->>'sources_stale')::integer<>1
    or (v->>'needs_attention')::boolean is not true
  then raise exception 'STALLED_REPLAY_CURSOR_NOT_DETECTED: %',v;end if;

  update public.scene_source_replay_controls set enabled=false where singleton;
  v:=private.scene_replay_health_snapshot(30);
  if v->>'status'<>'disabled' or (v->>'needs_attention')::boolean is true
  then raise exception 'INTENTIONALLY_DISABLED_REPLAY_MISREPORTED: %',v;end if;

  begin
    perform private.scene_replay_health_snapshot(5);
  exception when raise_exception then v_denied:=true;
  end;
  if not v_denied then raise exception 'INVALID_HEALTH_STALE_THRESHOLD_ACCEPTED';end if;
  if exists(select 1 from public.scene_contributions)
    or exists(select 1 from public.scene_reward_grant_receipts)
  then raise exception 'HEALTH_SNAPSHOT_CHANGED_PLAYER_DATA';end if;
  raise notice 'Scene replay health defaults, ACL, healthy/stale/disabled and aggregate checks passed';
end;
$$;
rollback;