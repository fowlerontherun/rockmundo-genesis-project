import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20261019120500_botb_same_city_day_dedup.sql", "utf8");

describe("Battle of the Bands city-local event deduplication", () => {
  it("compares each event's local calendar day, not its UTC timestamp", () => {
    expect(sql).toContain("existing.scheduled_date AT TIME ZONE v_city.city_timezone");
    expect(sql).toContain("::date=v_local_date");
    expect(sql).toContain("COALESCE(NULLIF(c.timezone,''),'UTC')");
  });

  it("counts grandfathered entered events toward the next three battles", () => {
    expect(sql).toContain("IF EXISTS(");
    expect(sql).toContain("v_count := v_count + 1;");
    expect(sql).toContain("IF v_count >= v_horizon THEN EXIT; END IF;");
    expect(sql).toContain("CONTINUE;");
    expect(sql).toContain("FOR v_i IN 0..(v_horizon + 12)");
  });

  it("never deletes already entered events, even while entry requests race", () => {
    expect(sql).toContain("AND NOT EXISTS(SELECT 1 FROM public.botb_entries b WHERE b.event_id=e.id)");
    expect(sql).toContain("EXISTS(SELECT 1 FROM public.botb_entries registered WHERE registered.event_id=kept.id)");
    expect(sql).toContain("FOR UPDATE OF e;");
    expect(sql).toContain("IF v_targets>10 THEN");
  });

  it("does not restore public event-generator access", () => {
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.generate_botb_events(integer) FROM PUBLIC,anon,authenticated");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.generate_botb_events(integer) TO service_role");
  });
});
