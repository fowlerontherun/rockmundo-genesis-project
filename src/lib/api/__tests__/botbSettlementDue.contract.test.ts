import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261019131500_botb_due_and_scheduler_serialization.sql",
  "utf8",
);

describe("Battle of the Bands settlement and mayor scheduling safety", () => {
  it("blocks premature resolution before any prize, fame or XP writes", () => {
    const guard = migration.indexOf("IF v_event.scheduled_date > now() THEN");
    const payout = migration.indexOf("v_new := replace(v_old,");
    expect(guard).toBeGreaterThan(0);
    expect(migration).toContain("'not_due'");
    expect(migration).toContain("EXECUTE v_new;");
    expect(payout).toBeGreaterThan(0);
  });

  it("requires an event still to be upcoming and past its start before entry eligibility", () => {
    expect(migration).toContain(
      "IF v_event.status <> 'upcoming' OR v_event.scheduled_date <= now() THEN",
    );
    expect(migration).toContain("This battle is no longer open");
    expect(migration).toContain("TO authenticated,service_role");
    expect(migration).toContain("FROM PUBLIC,anon;");
  });

  it("serializes the cycle with the mayor's city-row lock", () => {
    expect(migration).toContain("FROM public.cities c ORDER BY c.id FOR UPDATE OF c");
    expect(migration).toContain("FROM public.botb_city_settings s WHERE s.city_id=v_city.id");
    expect(migration).toContain("IF NOT FOUND THEN");
    expect(migration).toContain("v_weekday:=5");
  });

  it("prevents same-local-day duplicates and keeps three future events per city", () => {
    expect(migration).toContain("AT TIME ZONE v_city.city_timezone");
    expect(migration).toContain("existing.status='upcoming'");
    expect(migration).toContain("::date=v_local_date");
    expect(migration).toContain("v_count := v_count + 1");
    expect(migration).toContain("ON CONFLICT(city_id,scheduled_date) DO NOTHING");
    expect(migration).toContain("v_horizon integer := LEAST(12,GREATEST(1,COALESCE(p_horizon_events,3)))");
  });

  it("limits settlement to privileged job callers", () => {
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.resolve_botb_event(uuid)");
    expect(migration).toContain("FROM PUBLIC,anon,authenticated");
    expect(migration).toContain("TO service_role");
  });

  it("aborts instead of applying a partial patch if the runtime has drifted", () => {
    expect(migration).toContain("BOTB functions drifted: stop and review before applying");
    expect(migration).toContain("BOTB resolver expected insertion point missing");
    expect(migration).toContain("BOTB eligibility expected insertion point missing");
  });
});
