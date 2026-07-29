import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20291218242400_canonical_finance_command_center.sql",
  ),
  "utf8",
);
const apiSource = fs.readFileSync(
  path.resolve("src/lib/api/financeCommandCenter.ts"),
  "utf8",
);

describe("canonical finance command center contract", () => {
  it("derives the dashboard from the authenticated active character", () => {
    expect(migration).toContain("auth.uid()");
    expect(migration).toContain("current_active_player_profile_id()");
    expect(migration).toContain("active_profile_not_owned");
    expect(migration).toContain("profile.user_id = actor_user_id");
  });

  it("uses canonical accounts, transactions, banking and loan contracts", () => {
    expect(migration).toContain("public.get_banking_dashboard()");
    expect(migration).toContain("public.financial_accounts");
    expect(migration).toContain("public.financial_transactions");
    expect(migration).toContain("public.loan_contracts");
    expect(migration).toContain("public.player_investments");
  });

  it("keeps internal movements out of earnings and expenses", () => {
    expect(migration).toContain("THEN 'transfer'");
    expect(migration).toContain("internal_savings_transfer");
    expect(migration).toContain("is_external_cash_flow");
    expect(migration).toContain("externalCashFlow");
    expect(migration).toContain("NOT EXISTS (");
  });

  it("keeps band treasuries separate from personal net worth", () => {
    expect(migration).toContain("treasury.metadata->>'account_role' = 'band_treasury'");
    expect(migration).toContain("'treasuries', band_row.treasuries");
    expect(migration).toContain(
      "'netWorthMinor', personal_accounts_minor + investment_value_minor - total_loans_minor",
    );
    expect(migration).not.toContain("playerShare");
  });

  it("does not silently combine other currencies into the headline total", () => {
    expect(migration).toContain("primary_currency");
    expect(migration).toContain("'otherCurrencyBalances', other_currency_balances_json");
    expect(migration).toContain("<> primary_currency");
    expect(migration).not.toContain("'USD'");
  });

  it("cannot regress to the legacy command center sources", () => {
    expect(migration).not.toContain("profiles.cash");
    expect(migration).not.toContain("band_balance");
    expect(migration).not.toContain("band_earnings");
  });

  it("exposes a typed and bounded frontend RPC", () => {
    expect(apiSource).toContain('"get_my_finance_command_center"');
    expect(apiSource).toContain("p_transaction_limit: safeLimit");
    expect(apiSource).toContain("Math.min(Math.max(Math.trunc(transactionLimit), 1), 250)");
    expect(apiSource).toContain("FinanceCommandCenter");
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.get_my_finance_command_center(integer) TO authenticated, service_role",
    );
  });
});
