-- Fully rolled-back tests: status polling must not strand expired cooking
-- attempts, expire live ones prematurely, or grant food.
do $test$
declare
  p uuid;
  expired_session uuid;
  future_session uuid;
  result jsonb;
  original_batches integer;
  original_sessions integer;
begin
  if has_function_privilege('authenticated','public.expire_stale_cooking_session(uuid)','EXECUTE')
    or has_function_privilege('anon','public.expire_stale_cooking_session(uuid)','EXECUTE')
    or not has_function_privilege('service_role','public.expire_stale_cooking_session(uuid)','EXECUTE')
  then raise exception 'Expired session RPC exposes privileged access'; end if;

  select count(*) into original_batches from public.cooking_food_batches;
  select count(*) into original_sessions from public.cooking_sessions;
  select id into p from public.profiles prof
    where not exists(select 1 from public.cooking_sessions sess
      where sess.profile_id=prof.id and sess.status in ('pending','running'))
    order by prof.id limit 1;
  if p is null then raise exception 'No profile available for rollback fixture'; end if;

  begin
    expired_session:=gen_random_uuid();
    insert into public.cooking_sessions
      (id,profile_id,recipe_slug,mode,status,started_at,expires_at)
    values (expired_session,p,'rice-bowl','manual','pending',
      clock_timestamp()-interval '180 seconds',
      clock_timestamp()-interval '60 seconds');
    result:=public.expire_stale_cooking_session(expired_session);
    if result->>'status'<>'timed_out' or (result->>'expired')::boolean is not true
    then raise exception 'Expired session was not cleared: %',result; end if;
    if not exists(select 1 from public.cooking_sessions
      where id=expired_session and status='timed_out' and finished_at is not null)
    then raise exception 'Timed-out session not persisted within fixture'; end if;
    result:=public.expire_stale_cooking_session(expired_session);
    if result->>'status'<>'timed_out' or (result->>'expired')::boolean is not false
    then raise exception 'Expiry retry was not idempotent: %',result; end if;

    future_session:=gen_random_uuid();
    insert into public.cooking_sessions
      (id,profile_id,recipe_slug,mode,status,started_at,expires_at)
    values (future_session,p,'rice-bowl','manual','running',
      clock_timestamp()-interval '10 seconds',
      clock_timestamp()+interval '110 seconds');
    result:=public.expire_stale_cooking_session(future_session);
    if result->>'status'<>'running' or (result->>'expired')::boolean is not false
    then raise exception 'Healthy session was expired: %',result; end if;
    if exists(select 1 from public.cooking_sessions where id=future_session
      and (finished_at is not null or status<>'running'))
    then raise exception 'Healthy session was mutated'; end if;
    if (select count(*) from public.cooking_food_batches)<>original_batches
    then raise exception 'Expiry reconciliation awarded unauthorized food'; end if;
    raise exception using errcode='PZ001',message='ROLLBACK_EXPIRY_FIXTURES';
  exception when sqlstate 'PZ001' then
    perform set_config('app.cooking_expiry_test','passed',false);
  end;

  if (select count(*) from public.cooking_sessions)<>original_sessions
    or (select count(*) from public.cooking_food_batches)<>original_batches
  then raise exception 'Expiry fixtures persisted unexpectedly'; end if;
end;
$test$;
select current_setting('app.cooking_expiry_test',true) as expiry_test,
  (select count(*) from public.cooking_recipes where is_active) active_recipes,
  (select count(*) from public.cooking_city_market_offers where is_active) active_offers;
