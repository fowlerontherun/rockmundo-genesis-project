-- City Scene late-settlement and revoked mural regressions.
-- Run only against disposable Postgres fixture. Entire transaction rolls back.
begin;

do $$
declare
  v_city uuid := '20000000-0000-0000-0000-000000000001';
  v_user uuid := '10000000-0000-0000-0000-000000000001';
  v_profile uuid := '30000000-0000-0000-0000-000000000001';
  v_template uuid;
  v_expired_cycle uuid;
  v_active_cycle uuid;
  v_expired_obj uuid;
  v_active_obj uuid;
  v_late_event uuid;
  v_active_event uuid;
  v_changed int;
  v_board jsonb;
begin
  if (select count(*) from public.cities) <> 1
     or exists(select 1 from public.scene_challenge_cycles)
     or exists(select 1 from public.scene_contributions)
  then raise exception 'SCENE_LATE_EVENT_TEST_REQUIRES_ISOLATED_FIXTURE';end if;

  select id into strict v_template
  from public.scene_challenge_templates
  where cadence='daily' order by id limit 1;

  insert into public.scene_challenge_cycles(
    city_id,cadence,starts_at,ends_at,
    active_population_snapshot,theme_slug,target_total,status
  ) values(
    v_city,'daily',now()-interval '2 hours',now()-interval '30 minutes',
    1,'late-fixture',1,'expired'
  ) returning id into v_expired_cycle;

  insert into public.scene_challenge_cycles(
    city_id,cadence,starts_at,ends_at,
    active_population_snapshot,theme_slug,target_total,status
  ) values(
    v_city,'weekly',now()-interval '2 hours',now()+interval '2 hours',
    1,'revocation-fixture',1,'active'
  ) returning id into v_active_cycle;

  insert into public.scene_challenge_objectives(
    cycle_id,template_id,target_points,source_health_snapshot
  ) values(
    v_expired_cycle,v_template,1,'{"scoring_enabled":false}'::jsonb
  ) returning id into v_expired_obj;

  insert into public.scene_challenge_objectives(
    cycle_id,template_id,target_points,source_health_snapshot
  ) values(
    v_active_cycle,v_template,1,'{"scoring_enabled":false}'::jsonb
  ) returning id into v_active_obj;

  -- Event happened before the daily deadline but was finalised after it.
  insert into public.scene_contributions(
    objective_id,account_id,profile_id,city_id,source_type,
    source_event_id,source_completed_at,points
  ) values(
    v_expired_obj,v_user,v_profile,v_city,'isolated_late_fixture',
    gen_random_uuid()::text,now()-interval '45 minutes',1
  ) returning id into v_late_event;

  insert into public.scene_contributions(
    objective_id,account_id,profile_id,city_id,source_type,
    source_event_id,source_completed_at,points
  ) values(
    v_active_obj,v_user,v_profile,v_city,'isolated_active_fixture',
    gen_random_uuid()::text,now()-interval '20 minutes',1
  ) returning id into v_active_event;

  v_changed:=private.reconcile_scene_milestones(v_city);
  if v_changed<>8
    or (select count(*) from public.scene_milestones
        where revoked_at is null and cycle_id in (v_expired_cycle,v_active_cycle))<>8
    or (select count(*) from public.scene_challenge_cycles
        where id in(v_expired_cycle,v_active_cycle) and status='completed')<>2
  then raise exception 'LATE_EVENT_DID_NOT_COMPLETE_EXPIRED_CYCLE: %',v_changed;end if;

  perform set_config('request.jwt.claim.sub',v_user::text,true);
  v_board:=public.get_city_scene_board(v_city);
  if not exists(
    select 1 from jsonb_array_elements(v_board->'cycles') c
    where c->>'id'=v_active_cycle::text
      and jsonb_array_length(c->'milestones')=4
  ) then raise exception 'ACTIVE_MURAL_MILESTONES_NOT_VISIBLE';end if;

  update public.scene_contributions
  set invalidated_at=now()
  where id in(v_late_event,v_active_event);

  v_changed:=private.reconcile_scene_milestones(v_city);
  if v_changed<>8
    or (select count(*) from public.scene_milestones
      where cycle_id in(v_expired_cycle,v_active_cycle)
        and revoked_at is not null)<>8
    or not exists(select 1 from public.scene_challenge_cycles
      where id=v_expired_cycle and status='expired')
    or not exists(select 1 from public.scene_challenge_cycles
      where id=v_active_cycle and status='active')
  then raise exception 'INVALIDATION_FAILED_TO_RETRACT_MURAL_AND_CYCLE: %',v_changed;end if;

  v_board:=public.get_city_scene_board(v_city);
  if not exists(
    select 1 from jsonb_array_elements(v_board->'cycles') c
    where c->>'id'=v_active_cycle::text
      and jsonb_array_length(c->'milestones')=0
      and (c->>'earned_points')::int=0
  ) then raise exception 'INVALIDATED_MURAL_STILL_VISIBLE_ON_BOARD';end if;

  update public.scene_contributions
  set invalidated_at=null
  where id in(v_late_event,v_active_event);

  v_changed:=private.reconcile_scene_milestones(v_city);
  if v_changed<>8
    or (select count(*) from public.scene_milestones
      where cycle_id in(v_expired_cycle,v_active_cycle))<>8
    or (select count(*) from public.scene_milestones
      where cycle_id in(v_expired_cycle,v_active_cycle)
        and revoked_at is null)<>8
  then raise exception 'RESTORING_VALID_SOURCE_FAILED: %',v_changed;end if;

  if private.reconcile_scene_milestones(v_city)<>0
  then raise exception 'SCENE_MURAL_RECONCILIATION_NOT_IDEMPOTENT';end if;

  if exists(select 1 from public.scene_reward_grant_receipts)
  then raise exception 'RECONCILIATION_ISSUED_UNAUTHORISED_XP';end if;

  raise notice 'City Scene late event, expiration, revocation, board, restore and replay checks passed';
end;
$$;
rollback;
