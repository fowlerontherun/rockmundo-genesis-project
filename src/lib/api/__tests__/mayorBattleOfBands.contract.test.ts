import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20261019090000_mayor_controlled_battle_of_the_bands.sql", "utf8");
const mayorUi = readFileSync("src/components/city/MayorBattleOfBandsTab.tsx", "utf8");
const mayorPage = readFileSync("src/pages/MayorDashboard.tsx", "utf8");
const nav = readFileSync("src/config/mayorOfficeNavigation.ts", "utf8");
const battleUi = readFileSync("src/pages/BattleOfTheBands.tsx", "utf8");

describe("Mayor-controlled Battle of the Bands contracts", () => {
  it("exposes a dedicated, mayor-gated Live Events area", () => {
    expect(nav).toContain('section: "events"');
    expect(mayorPage).toContain('section === "events"');
    expect(mayorPage).toContain("useIsCurrentMayor(cityId)");
    expect(mayorUi).toContain('rpc("configure_city_botb"');
  });

  it("enforces mayor identity and validates weekday, cadence, and prize in SQL", () => {
    expect(sql).toContain("p.user_id=auth.uid()");
    expect(sql).toContain("cm.is_current=true");
    expect(sql).toContain("p_weekday NOT BETWEEN 0 AND 6");
    expect(sql).toContain("p_frequency_weeks NOT IN (1,2,4)");
    expect(sql).toContain("p_prize_money NOT BETWEEN 1000 AND 50000");
    expect(sql).toContain("BOTB_MAYOR_REQUIRED");
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public.configure_city_botb[^;]*FROM PUBLIC,anon/);
  });

  it("retains entered events while replacing unentered future dates", () => {
    expect(sql).toContain("FOR UPDATE;");
    expect(sql).toContain("NOT EXISTS(SELECT 1 FROM public.botb_entries be WHERE be.event_id=e.id)");
    expect(sql).toContain("PERFORM public.generate_botb_events(3)");
    expect(sql).toContain("ON CONFLICT(city_id,scheduled_date) DO NOTHING");
    expect(sql).toContain("COALESCE(s.prize_money,5000)");
    expect(battleUi).toContain("city-set cash prize");
  });

  it("derives attendees from competing bands and prize publicity", () => {
    expect(sql).toContain("FROM public.botb_entries be JOIN public.bands b");
    expect(sql).toContain("public.band_city_fans cf");
    expect(sql).toContain("v_entry_count*8");
    expect(sql).toContain("LN(1+v_prize)");
    expect(sql).toContain("v_city_capacity");
    expect(mayorUi).toContain("event.attendance.toLocaleString()");
  });

  it("guarantees nonnegative net city proceeds and credits the prize once", () => {
    expect(sql).toContain("v_sponsor_guarantee:=GREATEST(0::bigint");
    expect(sql).toContain("v_city_profit:=v_ticket_revenue+v_sponsor_guarantee-v_prize-v_operating_cost");
    expect(sql).toContain("balance=public.city_treasury.balance+EXCLUDED.balance");
    expect(sql).toContain("total_spent=public.city_treasury.total_spent+EXCLUDED.total_spent");
    expect(sql).toContain("'botb_event_settled'");
    expect(sql).toContain("'  VALUES (v_winner_band, v_prize, ''battle_of_the_bands'','");
    expect(sql).toContain("'    SET cash_awarded = v_prize, fame_gained'");
    expect(sql).toContain("'    SET fame ='");
    expect(sql).toContain("IF v_fn=v_original");
  });
});
