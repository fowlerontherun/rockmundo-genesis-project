-- Transactional integration test. All fixture changes intentionally rolled back.
-- Run as an administrator on a test database or in a controlled maintenance window.
do $verify$
declare
  p uuid;
  request_id uuid := gen_random_uuid();
  failed_id uuid := gen_random_uuid();
  action_start timestamptz;
  response jsonb;
  response_again jsonb;
  minted uuid;
  consumed_count integer;
  score integer;
begin
  select id into p from public.profiles prof
  where not exists (select 1 from public.cooking_sessions s
    where s.profile_id=prof.id and s.status in ('pending','running'))
  limit 1;
  if p is null then raise exception 'No available profile for cooking test'; end if;

  begin
    insert into public.cooking_recipes
      (slug,name,category,origin_region,method,portions,shelf_life_hours,is_active)
    values ('__test_manual_pan','Temporary cooking test','meals','Test','pan',2,24,true);
    insert into public.cooking_recipe_ingredients(recipe_slug,ingredient_slug,units_required)
    values ('__test_manual_pan','__test_manual_onion',1),
           ('__test_manual_pan','__test_manual_mushroom',1);
    insert into public.cooking_ingredient_cook_windows
      (ingredient_slug,ready_seconds,overdone_seconds,burnt_seconds)
    values ('__test_manual_onion',12,16,21),
           ('__test_manual_mushroom',18,23,30);

    for consumed_count in 1..2 loop
      insert into public.cooking_ingredient_lots
        (profile_id,ingredient_slug,quantity,quality,acquired_at,expires_at)
      values
        (p,'__test_manual_onion',1,80,clock_timestamp(),clock_timestamp()+interval '2 days'),
        (p,'__test_manual_mushroom',1,90,clock_timestamp(),clock_timestamp()+interval '2 days');
    end loop;

    if public.begin_cooking_session(p,'__test_manual_pan',request_id)<>request_id then
      raise exception 'Start failed'; end if;
    action_start := clock_timestamp()-interval '50 seconds';
    update public.cooking_sessions set started_at=action_start,
      expires_at=action_start+interval '120 seconds',
      updated_at=action_start where id=request_id;

    insert into public.cooking_session_actions
      (session_id,action_sequence,action_type,ingredient_slug,heat,recorded_at)
    values
      (request_id,1,'heat',null,'medium',action_start+interval '5 seconds'),
      (request_id,2,'add','__test_manual_onion',null,action_start+interval '6 seconds'),
      (request_id,3,'add','__test_manual_mushroom',null,action_start+interval '7 seconds'),
      (request_id,4,'remove','__test_manual_onion',null,action_start+interval '19 seconds'),
      (request_id,5,'remove','__test_manual_mushroom',null,action_start+interval '26 seconds');
    update public.cooking_sessions set status='running' where id=request_id;

    response := public.finalize_manual_cooking(request_id);
    if response->>'status'<>'completed' or (response->>'score')::integer<>100
      or (response->>'batch_id') is null then
      raise exception 'Correctly timed food did not complete: %',response;
    end if;
    minted := (response->>'batch_id')::uuid;
    response_again := public.finalize_manual_cooking(request_id);
    if (response_again->>'batch_id')::uuid is distinct from minted then
      raise exception 'Completion retry created a new batch';
    end if;
    select count(*) into consumed_count from public.cooking_food_batches
      where crafting_session_id=request_id;
    if consumed_count<>1 then raise exception 'Duplicate food minted'; end if;

    if public.begin_cooking_session(p,'__test_manual_pan',failed_id)<>failed_id then
      raise exception 'Failed-case start unavailable'; end if;
    action_start := clock_timestamp()-interval '50 seconds';
    update public.cooking_sessions set started_at=action_start,
      expires_at=action_start+interval '120 seconds',
      updated_at=action_start where id=failed_id;
    insert into public.cooking_session_actions
      (session_id,action_sequence,action_type,ingredient_slug,heat,recorded_at)
    values
      (failed_id,1,'heat',null,'medium',action_start+interval '5 seconds'),
      (failed_id,2,'add','__test_manual_onion',null,action_start+interval '6 seconds'),
      (failed_id,3,'add','__test_manual_mushroom',null,action_start+interval '7 seconds'),
      (failed_id,4,'remove','__test_manual_onion',null,action_start+interval '32 seconds'),
      (failed_id,5,'remove','__test_manual_mushroom',null,action_start+interval '39 seconds');
    update public.cooking_sessions set status='running' where id=failed_id;

    response := public.finalize_manual_cooking(failed_id);
    if response->>'status'<>'failed' or response->>'batch_id' is not null then
      raise exception 'Burned ingredients minted food: %',response;
    end if;
    if exists (select 1 from public.cooking_food_batches where crafting_session_id=failed_id) then
      raise exception 'Burned food created a batch'; end if;

    -- Force a nested subtransaction rollback of all temporary fixture writes.
    raise exception using errcode='PZ001',message='ROLLBACK_TEST_FIXTURE';
  exception when sqlstate 'PZ001' then
    raise notice 'PASS: good food, exact score, retry, burnt failure; fixture rolled back';
  end;
end $verify$;

select (select count(*) from public.cooking_recipes where slug='__test_manual_pan') as fixture_recipes,
       (select count(*) from public.cooking_ingredient_lots where ingredient_slug like '__test_manual_%') as fixture_lots,
       (select count(*) from public.cooking_food_batches where recipe_slug='__test_manual_pan') as fixture_food;
