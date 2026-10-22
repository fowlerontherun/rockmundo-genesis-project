-- Rollback-only integration: tested techniques cannot leave lasting player food,
-- ingredient debits, session data or active recipes. Run with DB-admin privileges.
do $test$
declare
  p uuid;
  action_start timestamptz;
  session_id uuid;
  run_session_id uuid;
  repeat_result jsonb;
  result jsonb;
  recipe_name text;
  method_name text;
  ingredient_a text;
  ingredient_b text;
  first_id uuid;
  recipe_status text;
  run_no integer;
  before_batches integer;
  before_sessions integer;
  before_lots integer;
  inserted_food integer;
  denied boolean;
begin
  if has_function_privilege('authenticated','public.record_cooking_technique_action(uuid,text,text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.finalize_cooking_technique(uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.replay_cooking_technique(uuid,timestamptz)','EXECUTE')
     or has_function_privilege('anon','public.record_cooking_technique_action(uuid,text,text,text)','EXECUTE')
     or has_function_privilege('anon','public.finalize_cooking_technique(uuid)','EXECUTE')
     then raise exception 'PUBLIC_TECHNIQUE_PRIVILEGE_LEAK'; end if;

  select count(*) into before_batches from public.cooking_food_batches;
  select count(*) into before_sessions from public.cooking_sessions;
  select count(*) into before_lots from public.cooking_ingredient_lots;

  select prof.id into p from public.profiles prof
    where not exists(select 1 from public.cooking_sessions s
      where s.profile_id=prof.id and s.status in ('pending','running'))
    order by prof.id limit 1;
  if p is null then raise exception 'NO_UNUSED_PROFILE_FOR_TEST'; end if;

  begin
    -- All recipe fixtures are deliberately server-disabled outside this block.
    insert into public.cooking_recipes
      (slug,name,category,origin_region,method,portions,shelf_life_hours,is_active)
    values
      ('__test_oven','Rollback test pie','baking','Test','oven',2,24,true),
      ('__test_simmer','Rollback test stew','soups','Test','simmer',2,24,true),
      ('__test_mix','Rollback test tea','drinks','Test','mix',2,24,true);
    insert into public.cooking_recipe_ingredients
      (recipe_slug,ingredient_slug,units_required)
    values
      ('__test_oven','rice',1),('__test_oven','mushrooms',1),
      ('__test_simmer','rice',1),('__test_simmer','mushrooms',1),
      ('__test_mix','tea',1),('__test_mix','milk',1);

    insert into public.cooking_ingredient_lots
      (profile_id,ingredient_slug,quantity,quality,acquired_at,expires_at)
    values
      (p,'rice',5,82,clock_timestamp(),clock_timestamp()+interval '2 days'),
      (p,'mushrooms',5,90,clock_timestamp(),clock_timestamp()+interval '2 days'),
      (p,'tea',5,82,clock_timestamp(),clock_timestamp()+interval '2 days'),
      (p,'milk',5,89,clock_timestamp(),clock_timestamp()+interval '2 days');

    for run_no in 1..4 loop
      method_name := case run_no when 1 then 'oven' when 2 then 'simmer'
          when 3 then 'mix' else 'oven' end;
      recipe_name := '__test_'||method_name;
      ingredient_a := case when method_name='mix' then 'milk' else 'mushrooms' end;
      ingredient_b := case when method_name='mix' then 'tea' else 'rice' end;
      session_id := gen_random_uuid();
      run_session_id := session_id;
      if public.begin_cooking_session(p,recipe_name,session_id)<>session_id
        then raise exception 'TECHNIQUE_SESSION_BEGIN_FAILED'; end if;

      -- Test the actual recorder, then shift fixture clock under rollback
      -- to exercise physical cook windows without waiting for real minutes.
      perform public.record_cooking_technique_action(session_id,'add',ingredient_a,null);
      perform public.record_cooking_technique_action(session_id,'add',ingredient_b,null);
      begin
        perform public.record_cooking_technique_action(session_id,'add',ingredient_b,null);
        raise exception 'DUPLICATE_INGREDIENT_ACCEPTED';
      exception when others then
        if sqlerrm not like '%duplicated technique ingredient%'
          then raise; end if;
      end;
      if method_name='mix' then
        begin
          perform public.record_cooking_technique_action(session_id,'heat',null,'high');
          raise exception 'HEATING_DRINK_ACCEPTED';
        exception when others then
          if sqlerrm not like '%Invalid technique heat%'
            then raise; end if;
        end;
        for inserted_food in 1..3 loop
          perform public.record_cooking_technique_action(session_id,'stir',null,null);
        end loop;
      else
        perform public.record_cooking_technique_action(session_id,'heat',null,'medium');
        begin
          perform public.record_cooking_technique_action(session_id,'add','rice',null);
          raise exception 'ADDED_AFTER_HEATING';
        exception when others then
          if sqlerrm not like '%Cannot add ingredients after preparation%'
            then raise; end if;
        end;
      end if;
      perform public.record_cooking_technique_action(session_id,'remove',ingredient_a,null);
      perform public.record_cooking_technique_action(session_id,'remove',ingredient_b,null);

      action_start := clock_timestamp()-interval '55 seconds';
      update public.cooking_sessions
         set started_at=action_start,
             expires_at=action_start+interval '120 seconds',
             updated_at=action_start where id=session_id;
      update public.cooking_session_actions
         set recorded_at=action_start+make_interval(secs=>(
            case action_sequence
              when 1 then 1
              when 2 then 2
              when 3 then 3
              when 4 then case
                when method_name='mix' then 4
                when run_no=4 then 40 else 19 end
              when 5 then case
                when method_name='mix' then 5
                when run_no=4 then 41 else 19 end
              when 6 then 6
              else 7 end))
         where cooking_session_actions.session_id=run_session_id
      ;
      -- Expected scores: 100 oven, 100 simmer, 100 drink, 0 burned oven.
      result := public.replay_cooking_technique(session_id);
      if run_no<4 and ((result->>'eligible')::boolean is distinct from true
          or (result->>'score')::integer<>100) then
        raise exception 'TECHNIQUE_REPLAY_REJECTED method % result %',method_name,result;
      end if;
      if run_no=4 and (result->>'eligible')::boolean is not false
        then raise exception 'BURNED_TECHNIQUE_IGNORED'; end if;

      result := public.finalize_cooking_technique(session_id);
      if run_no<4 and (result->>'status'<>'completed'
          or (result->>'score')::integer<>100 or result->>'batch_id' is null)
        then raise exception 'FAILED_REAL_TECHNIQUE_FINALIZE %, %',method_name,result;
      end if;
      if run_no=4 and (result->>'status'<>'failed' or result->>'batch_id' is not null)
        then raise exception 'BURNED_TECHNIQUE_MINTED_FOOD %',result; end if;
      repeat_result:=public.finalize_cooking_technique(session_id);
      if repeat_result->>'batch_id' is distinct from result->>'batch_id'
        then raise exception 'TECHNIQUE_RETRY_DUPLICATE_FOOD'; end if;
      if run_no<4 then
        select count(*) into inserted_food from public.cooking_food_batches
          where crafting_session_id=session_id;
        if inserted_food<>1 then raise exception 'WRONG_FOOD_BATCH_COUNT'; end if;
      end if;
    end loop;

    select count(*) into inserted_food from public.cooking_food_batches
      where recipe_slug in ('__test_oven','__test_simmer','__test_mix');
    if inserted_food<>3 then raise exception 'EXPECTED_THREE_DISHES'; end if;
    raise exception using errcode='PZ001',message='ROLLBACK_TEST_FIXTURES';
  exception when sqlstate 'PZ001' then
    perform set_config('app.cooking_techniques_verified','passed',false);
  end;
  if (select count(*) from public.cooking_food_batches)<>before_batches
    or (select count(*) from public.cooking_sessions)<>before_sessions
    or (select count(*) from public.cooking_ingredient_lots)<>before_lots
    or exists(select 1 from public.cooking_recipes where slug like '__test_%')
    then raise exception 'TECHNIQUE_ROLLBACK_FAILED'; end if;
end;
$test$;
select current_setting('app.cooking_techniques_verified',true) as technique_tests_passed,
 (select count(*) from public.cooking_recipes where is_active) as live_recipes,
 (select count(*) from public.cooking_city_market_offers where is_active) as live_offers,
 (select count(*) from public.cooking_food_batches) as persistent_batches;
