import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  "supabase/migrations/20261019141000_botb_isolated_batch_settlements.sql",
  "utf8",
);
const prizeConstraintSql = readFileSync(
  "supabase/migrations/20261019141500_botb_earnings_one_prize_per_event.sql",
  "utf8",
);

describe("Battle of the Bands isolated settlement cycle", () => {
  it("limits batch processing and ignores events already locked by another cycle", () => {
    expect(sql).toContain("WHERE status='upcoming' AND scheduled_date<=now()");
    expect(sql).toContain("ORDER BY scheduled_date ASC,id ASC");
    expect(sql).toContain("LIMIT 500");
    expect(sql).toContain("FOR UPDATE SKIP LOCKED");
  });

  it("puts each event settlement inside an exception subtransaction", () => {
    const loop = sql.indexOf("FOR v_event IN");
    const nestedBegin = sql.indexOf("    BEGIN\n      v_result := public.resolve_botb_event", loop);
    const nestedCatch = sql.indexOf("    EXCEPTION WHEN OTHERS THEN", nestedBegin);
    expect(loop).toBeGreaterThan(0);
    expect(nestedBegin).toBeGreaterThan(loop);
    expect(nestedCatch).toBeGreaterThan(nestedBegin);
    expect(sql).toContain("GET STACKED DIAGNOSTICS v_error_state = RETURNED_SQLSTATE");
    expect(sql).toContain("v_failed:=v_failed+1");
  });

  it("does not let a scheduler error block processing existing due events", () => {
    const schedulerCatch = sql.indexOf("  EXCEPTION WHEN OTHERS THEN");
    const eventLoop = sql.indexOf("  FOR v_event IN");
    expect(sql).toContain("v_generated := public.generate_botb_events(3)");
    expect(schedulerCatch).toBeGreaterThan(0);
    expect(schedulerCatch).toBeLessThan(eventLoop);
    expect(sql).toContain("v_generator_error := LEFT(");
  });

  it("records retryable per-event failures without recording cash transfers", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.botb_resolution_failures");
    expect(sql).toContain("REFERENCES public.botb_events(id) ON DELETE CASCADE");
    expect(sql).toContain("attempt_count=public.botb_resolution_failures.attempt_count+1");
    expect(sql).toContain("recovered_at=NULL");
    expect(sql).toContain("SET recovered_at=now()");
    expect(sql).toContain("last_sqlstate");
  });

  it("tracks the most recent scheduler status and settlement counts", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.botb_cycle_health");
    expect(sql).toContain("generated_events integer");
    expect(sql).toContain("completed_events integer");
    expect(sql).toContain("cancelled_events integer");
    expect(sql).toContain("failed_events integer");
    expect(sql).toContain("schedule_error");
    expect(sql).toContain("'resolved',v_resolved");
  });

  it("keeps exception and health data unavailable to ordinary players", () => {
    expect(sql).toContain("botb_resolution_failures ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("botb_cycle_health ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("FROM PUBLIC,anon,authenticated");
    expect(sql).toContain("TO service_role");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.run_botb_cycle() TO service_role");
  });
});

describe("Battle of the Bands exactly-one payout guard", () => {
  it("blocks a second cash earning with the same event_id", () => {
    expect(prizeConstraintSql).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS botb_one_prize_per_event",
    );
    expect(prizeConstraintSql).toContain("(metadata->>'event_id')");
    expect(prizeConstraintSql).toContain("source='battle_of_the_bands'");
    expect(prizeConstraintSql).toContain("metadata->>'event_id' IS NOT NULL");
  });

  it("does not silently erase old duplicate payments before adding the index", () => {
    expect(prizeConstraintSql).toContain("HAVING COUNT(*)>1");
    expect(prizeConstraintSql).toContain(
      "BOTB_DUPLICATE_HISTORICAL_EARNINGS: manual review required",
    );
    expect(prizeConstraintSql).not.toContain("DELETE FROM public.band_earnings");
  });
});
