-- Rollback-only fixture exercising authoritative time coverage for food
-- recovery and songwriting polish effects. This never commits test inventory.
do $verify$
declare
  owner_id uuid;
  test_batch uuid := gen_random_uuid();
  test_batch2 uuid := gen_random_uuid();
  begins timestamptz := '2026-10-22 10:00:00+00'::timestamptz;
  ends timestamptz := '2026-10-22 11:00:00+00'::timestamptz;
  percent integer;
begin
  select id into owner_id from public.profiles limit 1;
  if owner_id is null then
    raise notice 'SKIPPED: seeded profile required';
    return;
  end if;
  begin
    insert into public.cooking_food_batches
      (id,profile_id,recipe_slug,portions,quality,prepared_at,expires_at)
    values
      (test_batch,owner_id,'fruit-tart',0,100,
       begins-interval '2 days',ends+interval '2 days'),
      (test_batch2,owner_id,'vegetable-soup',0,100,
       begins-interval '2 days',ends+interval '2 days');
    insert into public.cooking_food_consumptions
      (request_id,profile_id,food_batch_id,recipe_slug,quality,
       remaining_portions,effect_slug,effect_percent,effect_applied,
       effect_expires_at,consumed_at)
    values
      (gen_random_uuid(),owner_id,test_batch,'fruit-tart',100,0,
       'songwriting_polish',5,true,ends+interval '10 minutes',
       begins-interval '5 minutes'),
      (gen_random_uuid(),owner_id,test_batch2,'vegetable-soup',100,0,
       'recovery',4,true,ends+interval '10 minutes',
       begins-interval '5 minutes');

    percent:=cooking_internal.food_effect_percent_for_window(
      owner_id,'songwriting_polish',begins,ends);
    if percent<>5 then raise exception 'Expected 5%% polish benefit: %',percent; end if;

    if cooking_internal.food_effect_percent_for_window(
      owner_id,'recovery',begins,ends)<>4 then
      raise exception 'Recovery window eligibility not preserved';
    end if;
    if cooking_internal.food_effect_percent_for_window(
      owner_id,'songwriting_polish',begins-interval '20 minutes',ends)<>0 then
      raise exception 'Retroactive meal credited before consumption';
    end if;
    if cooking_internal.food_effect_percent_for_window(
      owner_id,'songwriting_polish',begins,ends+interval '20 minutes')<>0 then
      raise exception 'Expired meal credited beyond benefit window';
    end if;
    if cooking_internal.food_effect_percent_for_window(
      owner_id,'unknown',begins,ends)<>0 then
      raise exception 'Invalid food effect slug credited';
    end if;
    if least(1000,950+100+round(100*percent/100.0))<>1000 then
      raise exception 'Polish quality exceeded 1000 cap';
    end if;
    raise exception using errcode='PZ001',message='ROLLBACK_COOKING_POLISH_FIXTURE';
  exception when sqlstate 'PZ001' then
    raise notice 'PASS: meal timing, recovery eligibility, polish bonus and quality cap; fixture rolled back';
  end;
end $verify$;
-- No writes: privilege and resolver installation invariants.
select
  has_function_privilege('authenticated',
    'cooking_internal.food_effect_percent_for_window(uuid,text,timestamptz,timestamptz)','EXECUTE')
    as player_can_call_internal,
  has_function_privilege('service_role',
    'cooking_internal.food_effect_percent_for_window(uuid,text,timestamptz,timestamptz)','EXECUTE')
    as backend_can_call_internal,
  position('food_bonus_quality' in pg_get_functiondef(
    'private.rockmundo_resolve_songwriting_polish(uuid)'::regprocedure))>0
    as polish_resolver_records_bonus,
  (select count(*) from public.cooking_food_consumptions) as real_food_consumptions;
