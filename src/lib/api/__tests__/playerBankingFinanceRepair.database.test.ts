import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20260827180000_repair_player_banking_finance_journal.sql",
  ),
  "utf8",
);
const rlsHardening = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20260827195800_harden_player_banking_rls.sql",
  ),
  "utf8",
);
const activityClassification = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20260827195900_classify_internal_player_finance_activity.sql",
  ),
  "utf8",
);

describe("live player banking and finance repair database contract", () => {
  it("installs the RPCs currently called by the banking page", () => {
    for (const rpc of [
      "open_my_bank_account",
      "deposit_my_wallet_to_bank",
      "withdraw_my_bank_to_wallet",
      "transfer_between_my_bank_accounts",
    ]) {
      expect(migration).toContain(`CREATE OR REPLACE FUNCTION public.${rpc}`);
      expect(migration).toContain(`public.${rpc}`);
    }
  });

  it("selects a living active character and never falls back to an arbitrary profile", () => {
    expect(migration).toContain("profile.died_at IS NULL");
    expect(migration).toContain("COALESCE(profile.is_active, false) DESC");
    expect(migration).not.toContain("COALESCE(is_active, true) LIMIT 1");
  });

  it("journals every profiles.cash delta through balanced finance entries", () => {
    expect(migration).toContain("public._journal_profile_wallet_delta(");
    expect(migration).toContain("AFTER INSERT OR UPDATE OF cash ON public.profiles");
    expect(migration).toContain("INSERT INTO public.financial_transactions");
    expect(migration).toContain("INSERT INTO public.financial_ledger_entries");
    expect(migration).toContain("(transaction_id, clearing.id, 'debit'");
    expect(migration).toContain("(transaction_id, wallet.id, 'credit'");
    expect(migration).toContain("(transaction_id, wallet.id, 'debit'");
    expect(migration).toContain("(transaction_id, clearing.id, 'credit'");
  });

  it("keeps internal bank movements visible without counting them as outgoings", () => {
    expect(migration).toContain("'classification', 'bank_transfer'");
    expect(migration).toContain("'external_cash_flow', false");
    expect(migration).toContain("transaction.tx_type IN ('interest', 'fee', 'band_deposit')");
  });

  it("feeds banking and finances from one normalized activity stream", () => {
    expect(migration).toContain("public._profile_finance_activity(");
    expect(migration).toContain("public.get_banking_dashboard()");
    expect(migration).toContain("public.get_my_finance_command_center(");
    expect(migration).toContain("'wallet_income'");
    expect(migration).toContain("'wallet_outgoing'");
  });

  it("prevents browser clients from bypassing RPC balance authority", () => {
    expect(migration).toContain(
      "REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER",
    );
    expect(migration).toContain(
      "ON TABLE public.bank_accounts FROM authenticated",
    );
    expect(migration).toContain(
      "ON TABLE public.bank_transactions FROM authenticated",
    );
  });

  it("gates legacy definitions so canonical schema resets remain compatible", () => {
    expect(migration).toContain("FROM information_schema.columns");
    expect(migration).toContain("column_name = 'profile_id'");
    expect(migration.match(/DO \$legacy\$/g)).toHaveLength(7);
  });

  it("keeps owner reads while removing obsolete direct-write RLS authority", () => {
    expect(rlsHardening).toContain(
      'DROP POLICY IF EXISTS "Users manage own bank accounts"',
    );
    expect(rlsHardening).toContain(
      'CREATE POLICY "Users read own bank accounts"',
    );
    expect(rlsHardening).toContain("WHERE profile.user_id = (SELECT auth.uid())");
    expect(rlsHardening).toContain("AS RESTRICTIVE");
    expect(rlsHardening).toContain("USING (false)");
    expect(rlsHardening).toContain("WITH CHECK (false)");
  });

  it("labels non-cash-flow activity as transfers in player history", () => {
    expect(activityClassification).toContain(
      "WHEN NOT activity.activity_external_cash_flow THEN 'transfer'",
    );
    expect(activityClassification).toContain(
      "public._profile_finance_activity_raw(",
    );
    expect(activityClassification).toContain(
      "REVOKE ALL ON FUNCTION public._profile_finance_activity(uuid, text)",
    );
  });
});
