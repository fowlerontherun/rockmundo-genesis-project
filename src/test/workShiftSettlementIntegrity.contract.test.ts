import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../../supabase/migrations/20261102070000_work_shift_settlement_integrity_4216.sql", import.meta.url), "utf8");
const audit = readFileSync(new URL("../../supabase/diagnostics/work_shift_settlement_audit.sql", import.meta.url), "utf8");
const regression = readFileSync(new URL("../../supabase/tests/work_shift_atomic_regression_harness.sql", import.meta.url), "utf8");
const injection = readFileSync(new URL("../../supabase/tests/work_shift_atomic_failure_injection_harness.sql", import.meta.url), "utf8");
const parallel = readFileSync(new URL("../../scripts/work-shifts/certify-parallel.mjs", import.meta.url), "utf8");

describe("work-shift settlement closure safeguards (#4216)", () => {
  it("keeps atomic XP idempotency unique without touching legacy shift IDs", () => {
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS experience_ledger_atomic_work_shift_ref_key");
    expect(migration).toContain("metadata ? 'transaction_ref'");
    expect(migration).not.toContain("DELETE FROM public.experience_ledger");
  });
  it("quarantines unverified completed and negative-shift outcomes", () => {
    expect(migration).toContain("work_shift_completed_without_receipt_requires_review");
    expect(migration).toContain("work_shift_negative_rewards_require_review");
    expect(migration).toContain("net_earnings = gross_earnings - city_tax");
  });
  it("checks city tax, zero/negative rewards, distinct characters, and retry", () => {
    expect(regression).toContain("v_tax<=0");
    expect(regression).toContain("zero shift inconsistency");
    expect(regression).toContain("accepted_negative_rewards");
    expect(regression).toContain("second profile settlement leaked or mismatched");
    expect(regression).toContain("ROLLBACK;");
  });
  it("provides truly independent concurrent and transaction failure scenarios", () => {
    expect(parallel).toContain('spawn("psql"');
    expect(parallel).toContain('spawnSync("psql"');
    expect(parallel).toContain("pg_sleep(3)");
    expect(parallel).toContain('"settled": false');
    expect(parallel).toContain("Only disposable LOCAL Postgres");
    expect(injection).toContain("injected_work_shift_step_failure");
    expect(injection).toContain("'work_shift_settlements'");
    expect(injection).toContain("ROLLBACK;");
  });
  it("limits retrospective investigation to read-only reporting", () => {
    expect(audit).toContain("legacy_duplicate_shift_xp");
    expect(audit).toContain("in_progress_without_matching_active_activity");
    // The prior grouped query correlated x.metadata directly and was invalid SQL.
    // Aggregate shift IDs first, then join tax records via the grouped alias.
    expect(audit).toContain("WITH duplicate_xp AS");
    expect(audit).toContain("LEFT JOIN LATERAL");
    expect(audit).toContain("c.reference_id::text=d.shift_id");
    expect(audit).not.toContain("t.reference_id::text=x.metadata->>'shift_id'");
    expect(audit).not.toMatch(/\b(?:DELETE|UPDATE|INSERT)\s+(?:FROM|INTO|public)/i);
  });
});
