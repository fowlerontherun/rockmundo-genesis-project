-- Isolated PostgreSQL integration test for city challenge period scaling,
-- objective caps and server-persisted mural stages. All fixture changes rollback.
begin;

do $$
declare
  v_city uuid := '20000000-0000-0000-0000-000000000001';
  v_profile uuid := '30000000-0000-0000-0000-000000000001';
  v_user uuid := '10000000-0000-0000-0000-000000000001';
  v_daily uuid;
  v_weekly uuid;
  v_monthly uuid;
  v_obj record;
  v_iteration integer := 0;
  v_board jsonb;
  v_milestones int;
begin
  -- This is only a test database with disabled templates and no challenge
  -- ledger entries. Never run on a live city.
  if exists(select 1 from public.scene_challenge_cycles)
     or exists(select 1 from public.scene_contributions)
     or (select count(*) from public.cities) <> 1
  then
    raise exception 'ISOLATED_CYCLE_TEST_DATABASE_REQUIRED';
  end if;

  update public.scene_challenge_templates set enabled = true;
  if (select count(*) from public.scene_challenge_templates where cadence='daily') <> 3
    or (select count(*) from public.scene_challenge_templates where cadence='weekly') <> 3
    or (select count(*) from public.scene_challenge_templates where cadence='monthly') <> 1
  then
    raise exception 'INCORRECT_SCENE_TEMPLATE_COUNTS';
  end if;

  if private.reconcile_city_scene_cycles(now(),v_city) <> 3 then
    raise exception 'EXPECTED_THREE_SCENE_CYCLES';
  end if;
  if private.reconcile_city_scene_cycles(now(),v_city) <> 0 then
    raise exception 'CYCLE_RECONCILIATION_NOT_IDEMPOTENT';
  end if;

  select id into v_daily from public.scene_challenge_cycles
    where city_id=v_city and cadence='daily';
  select id into v_weekly from public.scene_challenge_cycles
    where city_id=v_city and cadence='weekly';
  select id into v_monthly from public.scene_challenge_cycles
    where city_id=v_city and cadence='monthly';

  if not exists(select 1 from public.scene_challenge_cycles
    where id=v_daily and target_total=3 and active_population_snapshot=1)
    or not exists(select 1 from public.scene_challenge_cycles
    where id=v_weekly and target_total=6 and active_population_snapshot=1)
    or not exists(select 1 from public.scene_challenge_cycles
    where id=v_monthly and target_total=12 and active_population_snapshot=1)
  then
    raise exception 'SCENE_TARGET_EXCEEDS_ALLOWED_CAP_OR_WRONG_SCALE';
  end if;

  if (select coalesce(sum(target_points),0) from public.scene_challenge_objectives
    where cycle_id=v_daily) <> 3
    or (select count(*) from public.scene_challenge_objectives
    where cycle_id=v_daily) <> 3
    or (select coalesce(sum(target_points),0) from public.scene_challenge_objectives
    where cycle_id=v_weekly) <> 6
    or (select coalesce(sum(target_points),0) from public.scene_challenge_objectives
    where cycle_id=v_monthly) <> 12
  then
    raise exception 'SCENE_OBJECTIVE_TARGET_DISTRIBUTION_INVALID';
  end if;

  select id, target_points into v_obj
  from public.scene_challenge_objectives
  where cycle_id=v_daily order by id limit 1;

  -- Five credits in one source cannot satisfy all three daily objectives.
  insert into public.scene_contributions (
    objective_id,account_id,profile_id,city_id,
    source_type,source_event_id,source_completed_at,points
  ) values(
    v_obj.id,v_user,v_profile,v_city,
    'isolated_postgres_fixture','overfilled-daily-source',now(),5
  );

  if private.scene_capped_cycle_points(v_daily) <> 1 then
    raise exception 'ONE_OVERFILLED_OBJECTIVE_COMPLETED_ENTIRE_CITY';
  end if;
  v_milestones := private.reconcile_scene_milestones(v_city);
  if not exists(select 1 from public.scene_milestones
    where cycle_id=v_daily and percent_threshold=25)
    or exists(select 1 from public.scene_milestones
    where cycle_id=v_daily and percent_threshold=100)
    or exists(select 1 from public.scene_challenge_cycles
    where id=v_daily and status='completed')
  then
    raise exception 'PREMATURE_SCENE_POSTER_OR_CYCLE_COMPLETION';
  end if;

  for v_obj in
    select id,target_points from public.scene_challenge_objectives
    where cycle_id=v_daily and id <> (
      select id from public.scene_challenge_objectives
      where cycle_id=v_daily order by id limit 1
    )
    order by id
  loop
    v_iteration := v_iteration+1;
    insert into public.scene_contributions(
      objective_id,account_id,profile_id,city_id,
      source_type,source_event_id,source_completed_at,points
    ) values(
      v_obj.id,v_user,v_profile,v_city,
      'isolated_postgres_fixture','completed-other-'||v_iteration,now(),v_obj.target_points
    );
  end loop;

  if private.scene_capped_cycle_points(v_daily) <> 3 then
    raise exception 'COMPLETED_SCENE_NOT_FULLY_COUNTED';
  end if;
  perform private.reconcile_scene_milestones(v_city);
  if not exists(select 1 from public.scene_challenge_cycles
    where id=v_daily and status='completed')
    or (select count(*) from public.scene_milestones
      where cycle_id=v_daily) <> 4
  then
    raise exception 'COMPLETED_SCENE_POSTER_MILESTONES_MISSING';
  end if;

  perform set_config('request.jwt.claim.sub',v_user::text,true);
  v_board := public.get_city_scene_board(v_city);
  if jsonb_array_length(v_board->'cycles') <> 3
    or not exists (
      select 1 from jsonb_array_elements(v_board->'cycles') item
      where item->>'cadence'='daily'
        and (item->>'earned_points')::int=3
        and (item->>'target_total')::int=3
        and jsonb_array_length(item->'milestones')=4
    )
  then
    raise exception 'CITY_BOARD_DOES_NOT_MATCH_VERIFIED_CAPPED_PROGRESS';
  end if;

  raise notice 'City Scene cycle scaling, capped goals, and mural integration passed.';
end;
$$;
rollback;
