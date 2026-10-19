import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20261019120000_botb_shared_finance_forecasts.sql", "utf8",
);
const mayor = readFileSync("src/components/city/MayorBattleOfBandsTab.tsx", "utf8");
const hook = readFileSync("src/hooks/useBattleOfTheBands.ts", "utf8");

describe("Battle of the Bands live finance forecast", () => {
  it("reads city audience using participant city fans and fame", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.botb_estimate_event_finances");
    expect(migration).toContain("FROM public.botb_entries be");
    expect(migration).toContain("public.band_city_fans cf");
    expect(migration).toContain("COALESCE(b.total_fans,0)");
    expect(migration).toContain("COALESCE(b.fame,0)");
    expect(migration).toContain("LN(1+v_prize)");
    expect(migration).toContain("v_city_capacity");
  });

  it("does not show a fake funding shortfall before bands sign up", () => {
    expect(migration).toContain("IF v_band_count=0 THEN");
    expect(migration).toContain("v_prize,0,0,0::bigint,0::bigint,0::bigint,0::bigint");
    expect(mayor).toContain("Awaiting band entries to forecast attendance");
  });

  it("guards against city treasury losses and makes sponsorship explicit", () => {
    expect(migration).toContain("v_sponsors := GREATEST(0::bigint");
    expect(migration).toContain("v_net := v_ticket_revenue+v_sponsors-v_prize-v_production_cost");
    expect(migration).toContain("IF v_net < 0 THEN RAISE EXCEPTION 'BOTB_CITY_DEFICIT_BLOCKED'");
    expect(mayor).toContain("Sponsorship needed");
    expect(mayor).toContain("Expected city net");
  });

  it("settles from the same function as forecasts, before winner fame is granted", () => {
    expect(migration).toContain("FROM public.botb_estimate_event_finances(p_event_id)");
    expect(migration).toContain("IF NOT FOUND OR v_entry_count < 1 OR v_city_profit < 0");
    expect(migration).toContain("manual finance review required");
  });

  it("restricts the forecast to authenticated readers, and closes anonymous entry access", () => {
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.botb_estimate_event_finances(uuid) FROM PUBLIC,anon");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.botb_estimate_event_finances(uuid) TO authenticated,service_role");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.enter_battle_of_the_bands");
  });

  it("invalidates forecasts after mayor edits and band entry changes", () => {
    expect(mayor).toContain('queryKey: ["botb-event-finance-preview", eventId]');
    expect(mayor).toContain('invalidateQueries({ queryKey: ["botb-event-finance-preview"] })');
    expect(hook.match(/invalidateQueries\(\{ queryKey: \["botb-event-finance-preview"\] \}\)/g)?.length).toBe(2);
  });
});
