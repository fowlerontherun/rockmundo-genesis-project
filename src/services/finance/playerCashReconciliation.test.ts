import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260728120000_reconcile_player_cash_finance.sql",
  "utf8",
);

describe("player cash reconciliation migration", () => {
  it("converts visible whole-unit cash to canonical minor units", () => {
    expect(migration).toContain("coalesce(NEW.cash, 0)::numeric * 100");
    expect(migration).toContain("coalesce(p.cash, 0)::numeric * 100");
  });

  it("repairs existing accounts and synchronises later cash changes", () => {
    expect(migration).toContain("AFTER INSERT OR UPDATE OF cash ON public.profiles");
    expect(migration).toContain("ON CONFLICT (owner_type, owner_id) WHERE is_primary");
    expect(migration).toContain("current_balance_minor = greatest(");
    expect(migration).toContain("public.financial_accounts.reserved_balance_minor");
  });

  it("does not expose the internal trigger function to players", () => {
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.sync_profile_cash_financial_account() FROM PUBLIC, anon, authenticated",
    );
  });

  it("keeps visible company balances available to canonical cost checks", () => {
    expect(migration).toContain(
      "AFTER INSERT OR UPDATE OF balance ON public.companies",
    );
    expect(migration).toContain("companiesBalanceRole");
    expect(migration).toContain(
      "greatest(0, round(coalesce(c.balance, 0)::numeric * 100)::bigint)",
    );
  });
});
