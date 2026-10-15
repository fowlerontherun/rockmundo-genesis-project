import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repair = readFileSync(
  resolve(process.cwd(), "supabase/production-repairs/20261014_reconcile_existing_band_payroll_treasuries.sql"),
  "utf8",
);

describe("payroll treasury provenance repair (#4082)", () => {
  it("reconciles only two exact account and band identity pairs", () => {
    expect(repair).toContain("d40788d3-230c-440a-9ce7-98d337b8fac6");
    expect(repair).toContain("d3593fad-df6b-4613-8daf-c51ba35c6dfe");
    expect(repair).toContain("3b6c8c60-7e8e-456d-858a-d6f1dcb9a296");
    expect(repair).toContain("9e0e483c-66a7-495f-a027-2fb7aff3abf4");
    expect(repair).toContain("v_account_count <> 1");
    expect(repair).toContain("v_account.is_primary IS DISTINCT FROM TRUE");
  });

  it("requires a completed, matching canonical journal before tagging", () => {
    expect(repair).toContain("public.financial_ledger_entries");
    expect(repair).toContain("public.financial_transactions");
    expect(repair).toContain("tx.status::text <> 'completed'");
    expect(repair).toContain("v_ledger_balance IS DISTINCT FROM v_account.current_balance_minor");
    expect(repair).toContain("v_unsettled_count <> 0");
    expect(repair).toContain("FOR UPDATE");
    expect(repair).toContain("v_prior_role <> 'band_treasury'");
  });

  it("#4119 refuses to label a journalled finance account as the wrong gameplay treasury", () => {
    expect(repair).toContain("FROM public.band_treasuries bt");
    expect(repair).toContain("bt.band_id = v_target.band_id");
    expect(repair).toContain("bt.is_primary IS TRUE");
    expect(repair).toContain("bt.balance_minor = v_account.current_balance_minor");
    expect(repair).toContain("bt.balance_minor = COALESCE(v_band.band_balance,0)::bigint * 100");
    expect(repair).toContain("gameplay and finance balances differ");
    expect(repair.indexOf("gameplay and finance balances differ")).toBeLessThan(
      repair.indexOf("SET metadata = COALESCE"),
    );
  });

  it("changes only account metadata and cannot mint funds or run payroll", () => {
    const modified = repair.slice(repair.indexOf("DO $reconcile$"), repair.indexOf("COMMIT;"));
    expect(modified).toContain("UPDATE public.financial_accounts a");
    expect(modified).toContain("SET metadata = COALESCE");
    expect(modified).toContain("jsonb_build_object('account_role','band_treasury')");
    expect(modified).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(modified).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(modified).not.toMatch(/\bUPDATE\s+public\.bands\b/i);
    expect(modified).not.toMatch(/\bSET\s+current_balance_minor\b/i);
    expect(modified).not.toMatch(/\bSET\s+available_balance_minor\b/i);
    expect(modified).not.toMatch(/\bcron\.(schedule|unschedule|alter_job)\s*\(/i);
    expect(modified).not.toMatch(/\bprocess_weekly_band_payroll\s*\(/i);
  });
});
