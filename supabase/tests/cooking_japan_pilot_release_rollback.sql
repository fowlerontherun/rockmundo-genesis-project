-- Controlled rollback-only pilot preview, never leaves offers or recipes active.
-- Run via trusted DB administrator; no frontend is given release permissions.
do $pilot_test$
declare
 enabled_response jsonb;
 repeat_response jsonb;
 paused_response jsonb;
 audit_before integer;
 cash_before bigint;
 quantity_before bigint;
begin
 if (select count(*) from public.cooking_city_market_offers where is_active)<>0
    or (select count(*) from public.cooking_recipes where is_active)<>0 then
   raise exception 'COOKING_PILOT_TEST_REQUIRES_CLOSED_MARKETS';
 end if;
 select count(*) into audit_before from public.cooking_pilot_release_events;
 select coalesce(sum(cash),0) into cash_before from public.profiles;
 select coalesce(sum(stock),0) into quantity_before from public.cooking_city_market_offers;
 begin
   enabled_response := public.set_japan_rice_bowl_pilot(
     true,'Rollback-only pilot release verification'
   );
   if enabled_response->>'status'<>'changed' then
     raise exception 'First activation did not change state: %',enabled_response;
   end if;
   if (select count(*) from public.cooking_city_market_offers where is_active)<>6
      or (select count(*) from public.cooking_recipes where is_active)<>1
      or not (select is_active from public.cooking_recipes where slug='rice-bowl') then
     raise exception 'Pilot leaked outside Japan rice bowl';
   end if;
   if has_function_privilege('authenticated','public.set_japan_rice_bowl_pilot(boolean,text)','EXECUTE')
      or has_function_privilege('anon','public.set_japan_rice_bowl_pilot(boolean,text)','EXECUTE') then
     raise exception 'Public pilot control exposure';
   end if;
   repeat_response := public.set_japan_rice_bowl_pilot(
     true,'Rollback-only repeated activation check'
   );
   if repeat_response->>'status'<>'already_configured' then
     raise exception 'Repeat activation not idempotent';
   end if;
   paused_response := public.set_japan_rice_bowl_pilot(
     false,'Rollback-only emergency pilot pause'
   );
   if paused_response->>'status'<>'changed'
      or (select count(*) from public.cooking_recipes where is_active)<>0
      or (select count(*) from public.cooking_city_market_offers where is_active)<>0 then
     raise exception 'Emergency pause failed: %',paused_response;
   end if;
   if (select count(*) from public.cooking_pilot_release_events)<>audit_before+2 then
     raise exception 'Release audit missing or duplicated';
   end if;
   if (select coalesce(sum(cash),0) from public.profiles)<>cash_before
      or (select coalesce(sum(stock),0) from public.cooking_city_market_offers)<>quantity_before then
     raise exception 'Release control unexpectedly altered stock/cash';
   end if;
   raise exception using errcode='PZ001',message='ROLLBACK_PILOT_TEST';
 exception when sqlstate 'PZ001' then
   raise notice 'PASS: regional activation, idempotence, no wallet change, pause, audit, all rolled back';
 end;
end $pilot_test$;
select
 (select count(*) from public.cooking_recipes where is_active) as live_recipes,
 (select count(*) from public.cooking_city_market_offers where is_active) as live_market_offers,
 (select count(*) from public.cooking_pilot_release_events) as persisted_release_events;
