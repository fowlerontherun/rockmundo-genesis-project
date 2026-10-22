-- ROLLBACK-ONLY integration test for a dedicated test database.
-- Do not run as a production player. Uses an explicitly seeded profile with
-- temporary JWT claims and MUST roll back all test data.
do $verify$
declare
 p public.profiles%rowtype;
 batch_id uuid:=gen_random_uuid();
 expired_id uuid:=gen_random_uuid();
 first_key uuid:=gen_random_uuid();
 second_key uuid:=gen_random_uuid();
 result jsonb;
 duplicate jsonb;
 second jsonb;
 existing_count integer;
 stored_portions integer;
begin
 select * into p from public.profiles
 where is_active=true and died_at is null and deleted_at is null
 limit 1;
 if p.id is null then raise exception 'NEEDS_TEST_CHARACTER_FIXTURE'; end if;
 begin
  perform set_config('request.jwt.claim.sub',p.user_id::text,true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub',p.user_id::text,'role','authenticated',
      'is_anonymous',false)::text,true);
  if auth.uid() is distinct from p.user_id then
    raise exception 'Test runner could not set synthetic authenticated actor';
  end if;

  insert into public.cooking_food_batches
   (id,profile_id,recipe_slug,portions,quality,prepared_at,expires_at)
  values
   (batch_id,p.id,'rice-bowl',2,94,clock_timestamp()-interval '1 minute',
     clock_timestamp()+interval '24 hours'),
   (expired_id,p.id,'rice-bowl',2,94,clock_timestamp()-interval '2 days',
     clock_timestamp()-interval '1 day');

  result:=public.consume_cooking_food_atomic(p.id,batch_id,first_key);
  if result->>'status'<>'completed' or
     (result->>'remainingPortions')::integer<>1 or
     (result->>'effectApplied')::boolean is not true or
     (result->>'effectPercent')::integer<>5 then
    raise exception 'First food portion was not consumed and boosted once: %',result;
  end if;
  duplicate:=public.consume_cooking_food_atomic(p.id,batch_id,first_key);
  if duplicate->>'status'<>'already_completed' or
     duplicate->>'consumptionId' is distinct from result->>'consumptionId'
     or duplicate->>'effectExpiresAt' is distinct from result->>'effectExpiresAt' then
    raise exception 'Consumption retry was not idempotent: %',duplicate;
  end if;
  second:=public.consume_cooking_food_atomic(p.id,batch_id,second_key);
  if second->>'status'<>'completed'
     or (second->>'remainingPortions')::integer<>0
     or (second->>'effectApplied')::boolean is true then
    raise exception 'Second portion incorrectly stacked food effect: %',second;
  end if;

  select portions into stored_portions from public.cooking_food_batches
    where id=batch_id;
  if stored_portions<>0 then raise exception 'Portion count incorrect'; end if;
  select count(*) into existing_count from public.cooking_food_consumptions
    where food_batch_id=batch_id;
  if existing_count<>2 then raise exception 'Duplicate consumption receipts'; end if;
  select count(*) into existing_count from public.cooking_active_food_effects
    where profile_id=p.id and effect_slug='rehearsal';
  if existing_count<>1 then raise exception 'Duplicate same-type food boost'; end if;

  begin
   perform public.consume_cooking_food_atomic(p.id,batch_id,gen_random_uuid());
   raise exception 'Empty batch allowed third consumption';
  exception when others then
   if sqlerrm <> 'COOKING_FOOD_EXPIRED_OR_UNAVAILABLE' then raise; end if;
  end;
  begin
   perform public.consume_cooking_food_atomic(p.id,expired_id,gen_random_uuid());
   raise exception 'Expired batch allowed consumption';
  exception when others then
   if sqlerrm <> 'COOKING_FOOD_EXPIRED_OR_UNAVAILABLE' then raise; end if;
  end;
  begin
   perform public.consume_cooking_food_atomic(p.id,expired_id,first_key);
   raise exception 'Conflicting idempotency key was accepted';
  exception when others then
   if sqlerrm <> 'COOKING_FOOD_REQUEST_CONFLICT' then raise; end if;
  end;

  raise exception using errcode='PZ001',message='ROLLBACK_COOKING_FOOD_FIXTURE';
 exception when sqlstate 'PZ001' then
  raise notice 'PASS: owned food, one debit, stable retry, non-stacking, empty/expired/conflicting rejection; fixture rolled back';
 end;
end $verify$;
