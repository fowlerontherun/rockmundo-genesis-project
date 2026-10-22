-- Rollback-only test of service-only pan transitions; no persistent fixture.
do $cooking$
declare
  player_profile uuid;
  test_session uuid := gen_random_uuid();
  record_count integer;
begin
  select p.id into player_profile from public.profiles p
  where not exists (select 1 from public.cooking_sessions s
    where s.profile_id=p.id and s.status in ('pending','running'))
  limit 1;
  if player_profile is null then
    raise notice 'SKIPPED: no eligible test profile';
    return;
  end if;
  begin
    insert into public.cooking_recipes
      (slug,name,category,origin_region,method,portions,shelf_life_hours,is_active)
    values ('__test_plate_reentry','Temporary transition test','meals','Test','pan',1,24,false);
    insert into public.cooking_recipe_ingredients(recipe_slug,ingredient_slug,units_required)
    values ('__test_plate_reentry','__test_potato',1);
    insert into public.cooking_sessions
      (id,profile_id,recipe_slug,mode,status,started_at,expires_at)
    values (test_session,player_profile,'__test_plate_reentry','manual','pending',
      clock_timestamp(),clock_timestamp()+interval '120 seconds');
    perform public.record_cooking_action(test_session,'add','__test_potato',null);
    perform public.record_cooking_action(test_session,'remove','__test_potato',null);
    begin
      perform public.record_cooking_action(test_session,'add','__test_potato',null);
      raise exception 'Plated ingredient was illegally readded';
    exception when others then
      if sqlerrm <> 'Invalid ingredient transition' then raise; end if;
    end;
    select count(*) into record_count from public.cooking_session_actions
      where session_id=test_session;
    if record_count<>2 then raise exception 'Unexpected count of accepted actions: %',record_count; end if;
    raise exception using errcode='PZ001', message='ROLLBACK_PLATE_TEST';
  exception when sqlstate 'PZ001' then
    raise notice 'PASS: plated ingredient reentry rejected; fixture rolled back';
  end;
end $cooking$;
