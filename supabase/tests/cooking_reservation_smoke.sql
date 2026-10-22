-- Rollback-only smoke test. Run with a database administrator on a seeded
-- integration database. Never run as a public client or rely on this as E2E.
do $test$
declare
  p uuid;
  request_id uuid := gen_random_uuid();
  second_id uuid := gen_random_uuid();
  reservation_count integer;
  remaining integer;
begin
  select id into p from public.profiles limit 1;
  if p is null then
    raise notice 'SKIPPED: cooking reservation smoke test needs one seeded profile';
    return;
  end if;
  begin
    insert into public.cooking_recipes
      (slug,name,category,origin_region,method,portions,shelf_life_hours,is_active)
    values ('__test_cooking_reservation','Test recipe','meals','Test','pan',2,24,true);
    insert into public.cooking_recipe_ingredients
      (recipe_slug,ingredient_slug,units_required)
    values
      ('__test_cooking_reservation','__test_cook_a',1),
      ('__test_cooking_reservation','__test_cook_b',1);
    insert into public.cooking_ingredient_lots
      (profile_id,ingredient_slug,quantity,quality,acquired_at,expires_at)
    values
      (p,'__test_cook_a',1,80,clock_timestamp(),clock_timestamp()+interval '2 days'),
      (p,'__test_cook_b',1,95,clock_timestamp(),clock_timestamp()+interval '2 days');

    if public.begin_cooking_session(p,'__test_cooking_reservation',request_id) <> request_id
      or public.begin_cooking_session(p,'__test_cooking_reservation',request_id) <> request_id then
      raise exception 'Retry was not idempotent';
    end if;

    select count(*) into reservation_count
      from public.cooking_session_ingredients where session_id=request_id;
    if reservation_count<>2 then raise exception 'Expected two reserved ingredients'; end if;

    select sum(quantity) into remaining from public.cooking_ingredient_lots
      where profile_id=p and ingredient_slug in ('__test_cook_a','__test_cook_b');
    if remaining<>0 then raise exception 'Ingredient consumption was not atomic'; end if;

    begin
      perform public.begin_cooking_session(p,'__test_cooking_reservation',second_id);
      raise exception 'Simultaneous active session accepted';
    exception when others then
      if sqlerrm <> 'A cooking session is already active' then raise; end if;
    end;
    begin
      perform public.complete_cooking_batch(p,'__test_cooking_reservation',request_id);
      raise exception 'Unvalidated session minted food';
    exception when others then
      if sqlerrm <> 'Cooking session is not ready for completion' then raise; end if;
    end;

    -- The intentionally raised error rolls back the entire fixture and its
    -- ingredient deductions, including the new session.
    raise exception using errcode='PZ001', message='ROLLBACK_TEST_FIXTURE';
  exception when sqlstate 'PZ001' then
    raise notice 'PASSED: reservation, retry, duplicate session, and completion gate; fixture rolled back';
  end;
end $test$;
