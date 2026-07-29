import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const canonicalMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20291218242000_canonical_banking_dashboard_and_savings_goals.sql",
  ),
  "utf8",
);
const hardeningMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20291218242100_harden_canonical_savings_goal_compatibility.sql",
  ),
  "utf8",
);
const apiSource = fs.readFileSync(
  path.resolve("src/lib/api/savingsGoals.ts"),
  "utf8",
);

const finalDatabaseSource = `${canonicalMigration}\n${hardeningMigration}`;

describe("canonical savings goal database contract", () => {
  it("derives every operation from the active character", () => {
    expect(finalDatabaseSource).toContain("current_active_player_profile_id()");
    expect(finalDatabaseSource).toContain("owner_type = 'player'");
    expect(finalDatabaseSource).toContain("owner_id = profile_id");
  });

  it("backs goals with dedicated canonical financial accounts", () => {
    expect(canonicalMigration).toContain("financial_account_id uuid REFERENCES public.financial_accounts(id)");
    expect(canonicalMigration).toContain("'account_role', 'savings_goal'");
    expect(canonicalMigration).toContain("'legacy_unledgered_projection_minor'");
    expect(canonicalMigration).toContain("current_minor = 0");
  });

  it("moves contributions through the balanced finance primitive", () => {
    expect(hardeningMigration).toContain("public._move_financial_account_money(");
    expect(hardeningMigration).toContain("'internal_savings_transfer'");
    expect(hardeningMigration).not.toContain("UPDATE public.bank_accounts");
    expect(hardeningMigration).not.toContain("balance_minor = balance_minor -");
  });

  it("replaces the facade dashboard with canonical balances", () => {
    expect(canonicalMigration).toContain("CREATE OR REPLACE FUNCTION public.get_banking_dashboard()");
    expect(canonicalMigration).toContain("JOIN public.financial_accounts finance");
    expect(canonicalMigration).toContain("current_active_player_profile_id()");
    expect(canonicalMigration).toContain("'currencyCode', currency");
    expect(canonicalMigration).not.toContain("currencyCode', 'USD'");
  });

  it("retires the legacy savings goal write functions", () => {
    expect(canonicalMigration).toContain("public.create_savings_goal(text,bigint,date,uuid)");
    expect(canonicalMigration).toContain("public.contribute_to_savings_goal(uuid,uuid,bigint)");
    expect(canonicalMigration).toContain("FROM PUBLIC, anon, authenticated");
  });

  it("exposes the typed RPC boundary used by the next UI migration", () => {
    for (const rpc of [
      "create_my_savings_goal",
      "get_my_savings_goal_funding_sources",
      "preview_my_savings_goal_funding",
      "fund_my_savings_goal",
    ]) {
      expect(apiSource).toContain(`\"${rpc}\"`);
      expect(canonicalMigration + hardeningMigration).toContain(`public.${rpc}`);
    }
  });
});
