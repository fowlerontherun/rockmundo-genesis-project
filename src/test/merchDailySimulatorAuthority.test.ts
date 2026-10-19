import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const edge = readFileSync("supabase/functions/simulate-merch-sales/index.ts", "utf8");
const claims = readFileSync(
  "supabase/migrations/20261019103541_secure_daily_merch_simulation_claim_and_cron.sql",
  "utf8",
);
const sales = readFileSync(
  "supabase/migrations/20261019103803_merch_daily_simulation_order_receipts.sql",
  "utf8",
);
const harness = readFileSync(
  "supabase/tests/merch_daily_scheduler_authority_harness.sql",
  "utf8",
);

describe("daily simulated merchandise scheduler authority (#4249)", () => {
  it("denies unauthenticated/player-originated triggers before reading sales data", () => {
    const auth = edge.indexOf('"verify_internal_cron_secret"');
    const body = edge.indexOf("await safeJson(req)", auth);
    const claim = edge.indexOf('"claim_daily_merch_simulation"');
    const jobs = edge.indexOf("await startJobRun");
    const fetch = edge.indexOf('.from("bands")');
    expect(edge).toContain('req.method !== "POST"');
    expect(edge).toContain('"x-cron-secret"');
    expect(edge).toContain("status: 401");
    expect(auth).toBeGreaterThan(0);
    expect(claim).toBeGreaterThan(auth);
    expect(jobs).toBeGreaterThan(claim);
    expect(body).toBeGreaterThan(claim);
    expect(fetch).toBeGreaterThan(jobs);
  });

  it("claims one UTC day with a SQL primary key and seeds completed historical days", () => {
    expect(claims).toContain("sales_day date primary key");
    expect(claims).toContain("status in ('running','completed','failed')");
    expect(claims).toContain("job_name='simulate-merch-sales' AND status='success'");
    expect(claims).toContain("ON CONFLICT (sales_day) DO NOTHING");
    expect(claims).toContain("time '06:00'");
    expect(claims).toContain("'before_utc_06'");
    expect(claims).toContain("'already_claimed'");
    expect(claims).toContain("status='running'");
    expect(claims).toContain("FROM PUBLIC,anon,authenticated");
  });

  it("schedules only through Vault at 06 UTC, retaining existing job identity", () => {
    expect(claims).toContain("'simulate-merch-sales-daily','0 6 * * *'");
    expect(claims).toContain("vault.decrypted_secrets");
    expect(claims).toContain("'x-cron-secret'");
    expect(claims).toContain("v_new IS DISTINCT FROM v_original");
    expect(claims).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
  });

  it("records every synthetic sale within the locked run with its own unique order receipt", () => {
    expect(sales).toContain("PRIMARY KEY (run_id,sale_sequence)");
    expect(sales).toContain("order_id uuid NOT NULL UNIQUE");
    expect(sales).toContain("for update");
    expect(sales).toContain("public.record_merch_sale_atomic");
    expect(sales).toContain("'already_recorded'");
    expect(sales).toContain("status='running'");
    expect(edge).toContain('"record_simulated_merch_sale_atomic"');
    expect(edge).toContain("p_run_id: simulationRunId");
    expect(edge).toContain("p_sale_sequence: ++saleSequence");
    expect(edge).not.toContain('supabase.rpc("record_merch_sale_atomic"');
  });

  it("paginates bands and variants beyond the PostgREST row limit", () => {
    expect(edge).toContain(".range(offset, offset + 499)");
    expect(edge).toContain("merchIds.slice(from, from + 150)");
    expect(edge).toContain(".order(\"id\")");
  });

  it("does not auto-replay partial failures or quietly ignore settlement errors", () => {
    expect(edge).toContain('"finish_daily_merch_simulation"');
    expect(edge).toContain('p_status: "failed"');
    expect(edge).toContain('p_status: "completed"');
    expect(edge).toContain("manual settlement reconciliation required");
    expect(edge).toContain("throw new Error(`Merch band earnings failed:");
    expect(edge).toContain("throw new Error(`360 label settlement failed:");
    expect(edge).toContain("throw new Error(`Merch tax settlement failed:");
  });

  it("retains a production-safe BEGIN/ROLLBACK certification suite", () => {
    expect(harness).toContain("BEGIN;");
    expect(harness).toContain("ROLLBACK;");
    expect(harness).toContain("merch_simulation_duplicate_daily_claim");
    expect(harness).toContain("unknown_merch_run_accepted");
    expect(harness).toContain("merch_simulation_privileged_function_access_drift");
  });
});
