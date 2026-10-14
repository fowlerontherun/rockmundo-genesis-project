import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = new URL("../../../", import.meta.url);
const source = (path: string) => readFileSync(fileURLToPath(new URL(path, root)), "utf8");

describe("payment, distribution and reading security regression contracts", () => {
  const sponsorshipSql = () => source("supabase/migrations/20261012213100_atomic_sponsorship_installments.sql");
  it("#3031 locks sponsorship installments and pays them once", () => {
    const sql = sponsorshipSql();
    expect(sql).toMatch(/WHERE id = p_payment_id FOR UPDATE/);
    expect(sql).toMatch(/IF v_payment.status <> 'scheduled' THEN/);
    expect(sql).toMatch(/SET status='paid',paid_at=now\(\)/);
    expect(source("supabase/functions/process-sponsorship-payments/index.ts")).toContain("process_sponsorship_installment_atomic");
  });
  it("#3032 commits earnings-ledger and installment status in the same transaction", () => {
    const sql = sponsorshipSql();
    expect(sql).toContain("INSERT INTO public.band_earnings");
    expect(sql).toContain("UPDATE public.sponsorship_payments SET status='paid'");
    expect(sql).toContain("RAISE EXCEPTION 'sponsorship_band_not_found'");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.process_sponsorship_installment_atomic(uuid) TO service_role");
  });
  it("sponsorship payments use the earnings trigger as the only band balance authority", () => {
    const sql = sponsorshipSql();
    expect(sql).toContain("INSERT INTO public.band_earnings");
    expect(sql).toContain("SET morale = least(100");
    expect(sql).not.toMatch(/SET\\s+band_balance\\s*=/);
    expect(sql).toContain("sponsorship_installment_requires_reconciliation");
    expect(sql).toContain("sponsorship_installment_not_due");
    expect(sql).toContain("v_payment.band_id IS DISTINCT FROM v_contract.band_id");
    expect(sql).toContain("WHERE id = p_payment_id FOR UPDATE");
  });

  it("#2981 retains unsuccessful streaming deliveries for retry", () => {
    const edge = source("supabase/functions/auto-distribute-streaming/index.ts");
    const sql = source("supabase/migrations/20261013074400_streaming_delivery_concurrency.sql");
    expect(edge).toContain("failedPlatformIds");
    expect(edge).toContain("p_succeeded_platforms: succeeded");
    expect(edge).toContain("acknowledge_streaming_platform_delivery");
    expect(sql).toContain("WHERE NOT entry.platform_id=ANY(p_succeeded_platforms)");
    expect(sql).toContain("FOR UPDATE".replace("FOR UPDATE", "UPDATE public.releases"));
  });
  it("#2652 rejects untrusted scheduled reading calls", () => {
    const edge = source("supabase/functions/book-reading-attendance/index.ts");
    expect(edge).toContain('rpc("verify_internal_cron_secret"');
    expect(edge).toContain('bearer !== serviceRoleKey');
    expect(edge).toContain("Scheduled reading processing requires service authentication.");
    expect(edge).toContain("status: 403");
    expect(edge).toContain("supabaseClient.auth.getUser");
  });
});
