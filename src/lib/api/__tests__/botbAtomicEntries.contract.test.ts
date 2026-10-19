import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const citySql = readFileSync(
  "supabase/migrations/20261019135000_botb_city_scoped_schedule_generation.sql",
  "utf8",
);
const entrySql = readFileSync(
  "supabase/migrations/20261019135500_botb_atomic_entry_withdrawal.sql",
  "utf8",
);
const entryHook = readFileSync("src/hooks/useBattleOfTheBands.ts", "utf8");
const legacyPolicy = readFileSync(
  "supabase/migrations/20261019140500_botb_legacy_withdrawal_cutoff_policy.sql",
  "utf8",
);

describe("Battle of the Bands mayor scheduling deadlocks", () => {
  it("regenerates only the city a mayor controls", () => {
    expect(citySql).toContain("CREATE OR REPLACE FUNCTION public.generate_botb_city_events(");
    expect(citySql).toContain("WHERE c.id=p_city_id FOR UPDATE OF c");
    expect(citySql).toContain("PERFORM public.generate_botb_city_events(p_city_id,3);");
    expect(citySql).toContain("BOTB mayor configuration drift");
  });

  it("runs the hourly generator through the same per-city lock", () => {
    expect(citySql).toContain("FOR v_city IN SELECT id FROM public.cities ORDER BY id LOOP");
    expect(citySql).toContain("public.generate_botb_city_events(v_city.id,p_horizon_events)");
    expect(citySql).toContain("ON CONFLICT(city_id,scheduled_date) DO NOTHING");
    expect(citySql).toContain("e.scheduled_date AT TIME ZONE v_city.city_timezone");
  });

  it("does not give player clients access to the privileged event generator", () => {
    expect(citySql).toContain("REVOKE ALL ON FUNCTION public.generate_botb_city_events(uuid,integer)");
    expect(citySql).toContain("FROM PUBLIC,anon,authenticated;");
    expect(citySql).toContain("TO service_role;");
  });
});

describe("Battle of the Bands atomic registration and withdrawal", () => {
  it("locks the event before checking or inserting an entry", () => {
    expect(entrySql).toContain("WHERE id=p_event_id FOR UPDATE");
    expect(entrySql.indexOf("WHERE id=p_event_id FOR UPDATE")).toBeLessThan(
      entrySql.indexOf("v_check:=public.botb_check_eligibility"),
    );
    expect(entrySql).toContain("v_event.scheduled_date<=clock_timestamp()");
    expect(entrySql).toContain("BOTB_EVENT_CLOSED");
  });

  it("requires an active band member and matches their real profile", () => {
    expect(entrySql).toContain("bm.user_id=auth.uid()");
    expect(entrySql).toContain("COALESCE(bm.member_status,'active')='active'");
    expect(entrySql).toContain("bm.profile_id=p_profile_id");
    expect(entrySql).toContain("p.user_id=auth.uid()");
    expect(entrySql).toContain("COALESCE(s.archived,false)=false");
  });

  it("withdraws under the same event lock and checks the owner before DELETE", () => {
    expect(entrySql).toContain("CREATE OR REPLACE FUNCTION public.withdraw_battle_of_the_bands_entry");
    expect(entrySql).toContain("WHERE id=v_event_id FOR UPDATE");
    expect(entrySql).toContain("IF NOT FOUND OR v_event.status<>'upcoming'");
    expect(entrySql).toContain("v_event.scheduled_date<=clock_timestamp()");
    expect(entrySql).toContain("DELETE FROM public.botb_entries b");
    expect(entrySql).toContain("bm.band_id=b.band_id AND bm.user_id=auth.uid()");
    expect(entrySql).toContain("BOTB_NOT_BAND_MEMBER");
  });

  it("uses the secure withdrawal RPC and refreshes state in frontend", () => {
    expect(entryHook).toContain('rpc("withdraw_battle_of_the_bands_entry"');
    expect(entryHook).not.toContain('from("botb_entries").delete()');
    expect(entryHook).toContain('queryKey: ["botb-event-finance-preview"]');
    expect(entryHook).toContain('queryKey: ["botb-eligibility"]');
  });

  it("disallows anonymous RPC calls while retaining compatibility until deployment", () => {
    expect(entrySql).toContain("REVOKE ALL ON FUNCTION public.withdraw_battle_of_the_bands_entry(uuid)");
    expect(entrySql).toContain("TO authenticated,service_role");
    expect(entrySql).toContain("temporarily for existing deployed");
  });

  it("preserves legacy direct delete only before the event starts", () => {
    expect(legacyPolicy).toContain('DROP POLICY IF EXISTS "Band members can withdraw their entry"');
    expect(legacyPolicy).toContain("FOR DELETE TO authenticated");
    expect(legacyPolicy).toContain("COALESCE(bm.member_status,'active')='active'");
    expect(legacyPolicy).toContain("e.status='upcoming'");
    expect(legacyPolicy).toContain("e.scheduled_date>clock_timestamp()");
  });
});
