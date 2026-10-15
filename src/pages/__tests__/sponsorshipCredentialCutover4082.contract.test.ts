import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../../../", import.meta.url);
const source = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, root)), "utf8");
const settlement = source("supabase/production-repairs/20261015_sponsorship_atomic_installment_guarded_MANUAL_ONLY.sql");
const scheduler = source("supabase/production-repairs/20261015_sponsorship_vault_cron_install_AFTER_QUARANTINE.sql");
const quarantine = source("supabase/production-repairs/20261015_quarantine_embedded_jwt_cron_jobs.sql");
const worker = source("supabase/functions/process-sponsorship-payments/index.ts");

describe("#4082 staged finance settlement, credential removal and cron replacement", () => {
  it("only trusted service-role requests can settle a due installment", () => {
    expect(settlement).toContain("current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role'");
    expect(settlement).toContain("auth.uid() IS NOT NULL");
    expect(settlement).toContain("WHERE id=p_payment_id FOR UPDATE");
    expect(settlement).toContain("WHERE id=v_payment.contract_id FOR UPDATE");
    expect(settlement).toContain("WHERE id=v_payment.band_id FOR UPDATE");
    expect(settlement).toContain("REVOKE ALL ON FUNCTION public.process_sponsorship_installment_atomic(uuid)");
    expect(settlement).toContain("TO service_role;");
    expect(settlement).toContain("v_payment.scheduled_at IS NULL OR v_payment.scheduled_at > now()");
  });

  it("never reconciles legacy spendable balances by minting money", () => {
    expect(settlement).toContain("sponsorship_earnings_projection_drift");
    expect(settlement).toContain("sponsorship_primary_gameplay_treasury_mismatch");
    expect(settlement).toContain("sponsorship_gameplay_treasury_drift");
    expect(settlement).toContain("sponsorship_post_credit_projection_failed");
    expect(settlement).toContain("band_earnings_sponsorship_payment_once");
    expect(settlement).toContain("v_payment.band_id IS DISTINCT FROM v_contract.band_id");
    expect(settlement).not.toMatch(/UPDATE public\.bands\s+SET\s+band_balance/i);
    expect(settlement).not.toMatch(/UPDATE public\.band_treasuries\s+SET\s+balance_minor/i);
  });

  it("prevents double pay and preserves complete rollback on failure", () => {
    expect(settlement).toContain("IF v_payment.status IN ('paid','cancelled')");
    expect(settlement).toContain("'replayed',true");
    expect(settlement).toContain("sponsorship_installment_requires_reconciliation");
    expect(settlement).toContain("INSERT INTO public.band_earnings(");
    expect(settlement).toContain("UPDATE public.sponsorship_payments SET status='paid',paid_at=now()");
    expect(settlement).toContain("sponsorship_contract_payment_history_drift");
    expect(settlement).toContain("BEGIN;");
    expect(settlement).toContain("COMMIT;");
    expect(settlement).not.toContain("cron.schedule(");
  });

  it("requires JWT quarantine before reinstalling a Vault-backed scheduler", () => {
    expect(quarantine).toContain("cron.unschedule");
    expect(scheduler).toContain("QUARANTINE_BOTH_LEGACY_PAYMENT_JOBS_FIRST");
    expect(scheduler).toContain("cron.schedule(");
    expect(scheduler).toContain("vault.decrypted_secrets");
    expect(scheduler).toContain("'x-cron-secret'");
    expect(scheduler).toContain("process_sponsorship_installment_atomic(uuid)");
    expect(scheduler).toContain("has_function_privilege(");
    expect(scheduler).not.toMatch(/Bearer\s+eyJ[a-zA-Z0-9_-]{15,}/);
    expect(scheduler).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("checks authentication before any payout and supports a zero-settlement dry run", () => {
    expect(worker).toContain("if (req.method !== 'POST')");
    const auth = worker.indexOf("if (cronAuthError || cronAuthorized !== true)");
    const dry = worker.indexOf("if (payload?.dryRun === true)");
    const payout = worker.indexOf("'process_sponsorship_installment_atomic'");
    expect(auth).toBeGreaterThan(-1);
    expect(dry).toBeGreaterThan(auth);
    expect(payout).toBeGreaterThan(dry);
    expect(worker).toContain("paymentsPaid: 0");
  });
});
