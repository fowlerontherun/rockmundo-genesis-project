import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const edge = readFileSync("supabase/functions/auto-start-gigs/index.ts", "utf8");
const hook = readFileSync("src/hooks/useAutoGigStart.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20261019111346_internal_locked_auto_start_gigs_schedule.sql",
  "utf8",
);
const harness = readFileSync(
  "supabase/tests/internal_auto_start_gigs_security_harness.sql",
  "utf8",
);

describe("gig auto-start internal scheduler authority (#4221)", () => {
  it("retires the unsafe HTTP lifecycle worker", () => {
    expect(edge).toContain("status: 410");
    expect(edge).toContain("internal minute scheduler");
    expect(edge).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(edge).not.toContain("createClient");
    expect(edge).not.toContain("auto_start_scheduled_gigs(");
    expect(edge).not.toContain("startJobRun(");
  });

  it("preserves the existing minute cron job without embedded bearer tokens", () => {
    expect(migration).toContain("'auto-start-gigs','* * * * *'");
    expect(migration).toContain("SELECT public.run_auto_start_gigs_scheduled();");
    expect(migration).toContain("v_new IS DISTINCT FROM v_old");
    expect(migration).not.toContain("net.http_post");
    expect(migration).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
    expect(migration).not.toContain("Bearer ");
  });

  it("uses a transaction-scoped lock and retains authoritative gig start logic", () => {
    expect(migration).toContain("pg_try_advisory_xact_lock(4221,44)");
    expect(migration).toContain("previous_gig_start_still_running");
    expect(migration).toContain("v_receipt:=public.auto_start_scheduled_gigs()");
    expect(migration).toContain("public.cron_job_runs");
    expect(migration).toContain("RETURNING id INTO v_job_id");
    expect(migration).toContain("result_summary=v_receipt");
  });

  it("denies anonymous and ordinary player execution for both workers", () => {
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.run_auto_start_gigs_scheduled() FROM PUBLIC,anon,authenticated",
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.auto_start_scheduled_gigs() FROM PUBLIC,anon,authenticated",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.run_auto_start_gigs_scheduled() TO service_role",
    );
    expect(migration).toContain("allow_manual_trigger=false");
  });

  it("refreshes player gigs without allowing another global job trigger", () => {
    expect(hook).not.toContain("functions.invoke");
    expect(hook).not.toContain("auto_start_scheduled_gigs(");
    expect(hook).toContain("queryClient.invalidateQueries");
    expect(hook).toContain("60000");
  });

  it("provides an SQL-only, rollback-safe production verification suite", () => {
    expect(harness).toContain("BEGIN;");
    expect(harness).toContain("ROLLBACK;");
    expect(harness).toContain("gig_start_privileged_rpc_access_drift");
    expect(harness).toContain("gig_start_concurrency_or_job_log_guard_missing");
    expect(harness).not.toContain("SELECT public.run_auto_start_gigs_scheduled();");
    expect(harness).not.toContain("PERFORM public.auto_start_scheduled_gigs()");
  });
});
