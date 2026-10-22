-- Production-safe rollback-only integration coverage for atomic technique serving.
-- No test recipe, stock, cooked food or action history survives.
do $test$
declare
  p uuid;
  dish uuid;
  stress uuid;
  stamp timestamptz;
  serve_result jsonb;
  finish_result jsonb;
  rows_plated integer;
  before_batches integer;
  before_recipes integer;
begin
  if has_function_privilege('anon','public.serve_cooking_technique(uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.serve_cooking_technique(uuid)','EXECUTE')
    or not has_function_privilege('service_role','public.serve_cooking_technique(uuid)','EXECUTE')
  then raise exception 'Atomic plating RPC privilege leak'; end if;
  select count(*) into before_batches from public.cooking_food_batches;
  select count(*) into before_recipes from public.cooking_recipes;

  select id into p from public.profiles prof
    where not exists(select 1 from public.cooking_sessions s
      where s.profile_id=prof.id and s.status in ('pending','running'))
    order by id limit 1;
  if p is null then raise exception 'No disposable profile fixture candidate'; end if;

  begin
    insert into public.cooking_recipes
      (slug,name,category,origin_region,method,portions,shelf_life_hours,is_active)
    values ('__test_atomic_simmer','Rollback-only stew','soups','Test','simmer',2,24,true);
    insert into public.cooking_recipe_ingredients(recipe_slug,ingredient_slug,units_required)
      values ('__test_atomic_simmer','rice',1),
        ('__test_atomic_simmer','mushrooms',1);
    insert into public.cooking_ingredient_lots
      (profile_id,ingredient_slug,quantity,quality,acquired_at,expires_at)
      values (p,'rice',2,88,clock_timestamp(),clock_timestamp()+interval '2 days'),
        (p,'mushrooms',2,91,clock_timestamp(),clock_timestamp()+interval '2 days');

    dish:=gen_random_uuid();
    perform public.begin_cooking_session(p,'__test_atomic_simmer',dish);
    perform public.record_cooking_technique_action(dish,'add','rice',null);
    begin
      perform public.serve_cooking_technique(dish);
      raise exception 'Allowed incomplete loading';
    exception when others then
      if sqlerrm not like '%Incomplete recipe components%' then raise; end if;
    end;
    select count(*) into rows_plated from public.cooking_session_actions
      where session_id=dish and action_type='remove';
    if rows_plated<>0 then raise exception 'Premature serving created actions'; end if;

    perform public.record_cooking_technique_action(dish,'add','mushrooms',null);
    perform public.record_cooking_technique_action(dish,'heat',null,'medium');

    -- Explicitly adjust timestamps inside this rolled-back fixture only.
    stamp:=clock_timestamp()-interval '20 seconds';
    update public.cooking_sessions set started_at=stamp,
      expires_at=stamp+interval '120 seconds', updated_at=stamp where id=dish;
    update public.cooking_session_actions
      set recorded_at=stamp + make_interval(secs=>action_sequence)
      where session_id=dish;

    serve_result:=public.serve_cooking_technique(dish);
    if (serve_result->>'newly_plated')::integer<>2
      or (serve_result->>'plated')::integer<>2
    then raise exception 'Atomic plating mismatch %',serve_result; end if;
    serve_result:=public.serve_cooking_technique(dish);
    if (serve_result->>'newly_plated')::integer<>0
      then raise exception 'Atomic serving retry duplicated actions'; end if;
    select count(*) into rows_plated from public.cooking_session_actions
      where session_id=dish and action_type='remove';
    if rows_plated<>2 then raise exception 'Duplicate server serving events'; end if;

    finish_result:=public.finalize_cooking_technique(dish);
    if finish_result->>'status'<>'completed'
      or (finish_result->>'score')::integer<>100
      or finish_result->>'batch_id' is null
    then raise exception 'Atomic serving did not mint exact recipe %',finish_result; end if;
    if public.finalize_cooking_technique(dish)->>'batch_id'
       is distinct from finish_result->>'batch_id'
    then raise exception 'Repeated finish minted second food batch'; end if;

    stress:=gen_random_uuid();
    perform public.begin_cooking_session(p,'__test_atomic_simmer',stress);
    perform public.record_cooking_technique_action(stress,'add','rice',null);
    perform public.record_cooking_technique_action(stress,'add','mushrooms',null);
    perform public.record_cooking_technique_action(stress,'heat',null,'medium');
    insert into public.cooking_session_actions
      (session_id,action_sequence,action_type,heat,recorded_at)
    select stress,g,'heat','medium',clock_timestamp()
      from generate_series(4,254) g;
    begin
      perform public.serve_cooking_technique(stress);
      raise exception 'Allowed partially plated action-limit overflow';
    exception when others then
      if sqlerrm not like '%Technique action limit reached%' then raise; end if;
    end;
    select count(*) into rows_plated from public.cooking_session_actions
      where session_id=stress and action_type='remove';
    if rows_plated<>0 then raise exception 'Partial serving committed despite failure'; end if;

    raise exception using errcode='PZ001',message='ROLLBACK_ATOMIC_SERVING_FIXTURE';
  exception when sqlstate 'PZ001' then
    perform set_config('app.cooking_atomic_serve_tests','passed',false);
  end;
  if (select count(*) from public.cooking_food_batches)<>before_batches
    or (select count(*) from public.cooking_recipes)<>before_recipes
    or exists(select 1 from public.cooking_recipes where slug='__test_atomic_simmer')
    then raise exception 'Atomic serving rollback leaked fixtures'; end if;
end;
$test$;
select current_setting('app.cooking_atomic_serve_tests',true) as atomic_serving_test,
  (select count(*) from public.cooking_recipes where is_active) active_recipes,
  (select count(*) from public.cooking_city_market_offers where is_active) active_offers,
  (select count(*) from public.cooking_food_batches) persistent_food;
