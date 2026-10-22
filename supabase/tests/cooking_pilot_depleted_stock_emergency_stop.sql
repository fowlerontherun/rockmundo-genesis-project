-- Rollback-only emergency-stop regression: depleted stock and recipe drift
-- must never stop an operator from closing a currently active pilot.
-- All fixture writes use a savepoint-equivalent PL/pgSQL subtransaction.
do $cooking_shutdown$
declare
  opened jsonb;
  closed jsonb;
  key_city uuid;
  opening_balance bigint;
  before_pause_balance bigint;
  before_pause_stock bigint;
  after_pause_stock bigint;
  event_count integer;
begin
  if exists(select 1 from public.cooking_recipes where is_active)
     or exists(select 1 from public.cooking_city_market_offers where is_active) then
    raise exception 'COOKING_SHUTDOWN_TEST_REQUIRES_CLOSED_MARKET';
  end if;
  select count(*) into event_count from public.cooking_pilot_release_events;
  select coalesce(sum(cash),0) into opening_balance from public.profiles;
  begin
    opened := public.set_japan_rice_bowl_pilot(
      true,'Rollback test temporarily opens Japan pilot'
    );
    if opened->>'status'<>'changed' then raise exception 'PILOT_TEST_START_REJECTED'; end if;
    select id into key_city from public.cities
      where country='Japan' order by name limit 1;
    if key_city is null then raise exception 'NO_JAPANESE_TEST_CITY'; end if;

    -- Simulate players exhausting a specialty while recipe configuration drifts.
    update public.cooking_city_market_offers
       set stock=0 where city_id=key_city and ingredient_slug='rice';
    update public.cooking_recipes set method='oven' where slug='rice-bowl';

    -- Starting anew MUST fail its strict preflight. No activity is minted.
    begin
      perform public.set_japan_rice_bowl_pilot(
        true,'Deliberately reject relaunch after invalid recipe');
      raise exception 'INVALID_RESTART_WAS_ALLOWED';
    exception when others then
      if sqlerrm<>'COOKING_PILOT_RECIPE_DRIFT' then raise; end if;
    end;

    select coalesce(sum(cash),0) into before_pause_balance from public.profiles;
    select coalesce(sum(stock),0) into before_pause_stock
       from public.cooking_city_market_offers;
    closed := public.set_japan_rice_bowl_pilot(
      false,'Emergency shutdown when market stock is exhausted'
    );
    if closed->>'status'<>'changed'
       or (select count(*) from public.cooking_recipes where is_active)<>0
       or (select count(*) from public.cooking_city_market_offers where is_active)<>0 then
      raise exception 'EMERGENCY_SHUTDOWN_FAILED: %',closed;
    end if;
    select coalesce(sum(stock),0) into after_pause_stock
      from public.cooking_city_market_offers;
    if after_pause_stock<>before_pause_stock then
      raise exception 'EMERGENCY_SHUTDOWN_MUTATED_STOCK';
    end if;
    if (select coalesce(sum(cash),0) from public.profiles)<>before_pause_balance
       or before_pause_balance<>opening_balance then
      raise exception 'EMERGENCY_SHUTDOWN_CHANGED_WALLETS';
    end if;
    if (select count(*) from public.cooking_pilot_release_events)<>event_count+2 then
      raise exception 'EMERGENCY_SHUTDOWN_AUDIT_INVALID';
    end if;

    raise exception using errcode='PZ001',message='ROLLBACK_COOKING_SHUTDOWN_FIXTURE';
  exception when sqlstate 'PZ001' then
    perform set_config('app.cooking_emergency_shutdown_smoke','passed',false);
  end;
end $cooking_shutdown$;

select current_setting('app.cooking_emergency_shutdown_smoke',true) as shutdown_passed,
  (select count(*) from public.cooking_recipes where is_active) as enabled_recipes,
  (select count(*) from public.cooking_city_market_offers where is_active) as enabled_offers,
  (select count(*) from public.cooking_pilot_release_events) as recorded_release_events;
