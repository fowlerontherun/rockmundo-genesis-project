import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20261019145000_botb_fair_retry_queue.sql",
  "utf8",
);

describe("Battle of the Bands fair retry queue", () => {
  it("keeps the 500-event bound and locks only selected event rows", () => {
    expect(sql).toContain("LIMIT 500");
    expect(sql).toContain("FOR UPDATE OF e SKIP LOCKED");
    expect(sql).toContain("WHERE e.status='upcoming' AND e.scheduled_date<=now()");
  });

  it("backs off repeatedly failing upcoming events for at least 30 minutes", () => {
    expect(sql).toContain("LEFT JOIN public.botb_resolution_failures f");
    expect(sql).toContain("f.recovered_at IS NULL");
    expect(sql).toContain(
      "f.last_failed_at <= now()-interval '30 minutes'",
    );
  });

  it("prioritizes never-attempted events to prevent starvation", () => {
    expect(sql).toContain("ORDER BY COALESCE(f.attempt_count,0) ASC");
    expect(sql).toContain("e.scheduled_date ASC,e.id ASC");
  });

  it("patches the existing resolver safely without disturbing payouts", () => {
    expect(sql).toContain("pg_get_functiondef('public.run_botb_cycle()'::regprocedure)");
    expect(sql).toContain("BOTB_QUEUE_RUNTIME_DRIFT");
    expect(sql).toContain("BOTB_QUEUE_EXPECTED_PATCH_POINT_MISSING");
    expect(sql).toContain("EXECUTE v_new");
    expect(sql).not.toContain("INSERT INTO public.band_earnings");
    expect(sql).not.toContain("UPDATE public.bands");
    expect(sql).not.toContain("UPDATE public.city_treasury");
  });

  it("keeps the settlement function service-only", () => {
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.run_botb_cycle()");
    expect(sql).toContain("FROM PUBLIC,anon,authenticated");
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.run_botb_cycle() TO service_role",
    );
  });
});
