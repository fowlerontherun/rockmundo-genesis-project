import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const shiftWorker = readFileSync(new URL("../../supabase/functions/shift-clock-out/index.ts", import.meta.url), "utf8");
const scheduler = readFileSync(new URL("../../supabase/functions/process-scheduled-activities/index.ts", import.meta.url), "utf8");
const poller = readFileSync(new URL("../hooks/useAutoShiftClockOut.ts", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../../supabase/migrations/20261019102338_secure_shift_clock_out_cron_vault_auth.sql", import.meta.url),
  "utf8",
);
const harness = readFileSync(
  new URL("../../supabase/tests/shift_scheduler_authority_harness.sql", import.meta.url),
  "utf8",
);

describe("shift clock-out scheduler-only authority (#4215)", () => {
  it("authenticates a secret before parsing request data or processing shifts", () => {
    expect(shiftWorker).toContain("req.method !== 'POST'");
    expect(shiftWorker).toContain("'x-cron-secret'");
    expect(shiftWorker).toContain("'verify_internal_cron_secret'");
    expect(shiftWorker).toContain("isAuthorized !== true");
    expect(shiftWorker).toContain("status: 401");
    const auth = shiftWorker.indexOf("'verify_internal_cron_secret'");
    const parsed = shiftWorker.indexOf("await safeJson", auth);
    const logged = shiftWorker.indexOf("runId = await startJobRun", auth);
    const settlement = shiftWorker.indexOf("'settle_work_shift_atomic'", auth);
    expect(auth).toBeGreaterThan(-1);
    expect(parsed).toBeGreaterThan(auth);
    expect(logged).toBeGreaterThan(parsed);
    expect(settlement).toBeGreaterThan(logged);
  });

  it("uses the existing cron with a runtime vault secret and no embedded JWT", () => {
    expect(migration).toContain("'auto-clock-out-shifts'");
    expect(migration).toContain("'*/15 * * * *'");
    expect(migration).toContain("'x-cron-secret'");
    expect(migration).toContain("vault.decrypted_secrets");
    expect(migration).toContain("v_jobid IS DISTINCT FROM v_original_jobid");
    expect(migration).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
    expect(migration).not.toContain("Bearer ");
  });

  it("does not allow the browser or schedule worker to invoke global payroll", () => {
    expect(poller).not.toContain("functions.invoke");
    expect(poller).toContain('invalidateQueries({ queryKey: ["jobs"] })');
    expect(scheduler).not.toContain("invoke('shift-clock-out')");
    expect(scheduler).toContain("if (activity.activity_type === 'work') continue;");
    expect(scheduler).toContain("'verify_internal_cron_secret'");
  });

  it("keeps a read-only production-safe auth and grant harness", () => {
    expect(harness).toContain("BEGIN;");
    expect(harness).toContain("ROLLBACK;");
    expect(harness).toContain("shift_cron_auth_validation_incorrect");
    expect(harness).toContain("shift_cron_credential_or_command_drift");
    expect(harness).toContain("shift_privileged_rpc_grant_drift");
  });
});
