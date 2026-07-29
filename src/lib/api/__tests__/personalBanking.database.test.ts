import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20291218242300_harden_personal_banking_transfers.sql",
  ),
  "utf8",
);
const apiSource = fs.readFileSync(
  path.resolve("src/lib/api/personalBanking.ts"),
  "utf8",
);

const depositStart = migration.indexOf(
  "CREATE OR REPLACE FUNCTION public.deposit_my_wallet_to_bank",
);
const withdrawalStart = migration.indexOf(
  "CREATE OR REPLACE FUNCTION public.withdraw_my_bank_to_wallet",
);
const transferStart = migration.indexOf(
  "CREATE OR REPLACE FUNCTION public.transfer_between_my_bank_accounts",
);
const depositSource = migration.slice(depositStart, withdrawalStart);
const withdrawalSource = migration.slice(withdrawalStart, transferStart);
const transferSource = migration.slice(transferStart);

describe("personal banking transfer database contract", () => {
  it("derives all account operations from the selected active character", () => {
    expect(migration).toContain("current_active_player_profile_id()");
    expect(migration).toContain("owner_type = 'player'");
    expect(migration).toContain("owner_id = profile_id");
  });

  it("moves money only through the balanced canonical primitive", () => {
    expect(migration.match(/public\._move_financial_account_money\(/g)).toHaveLength(3);
    expect(migration).toContain("'bank_transfer'::public.financial_transaction_category");
    expect(migration).not.toContain("UPDATE public.bank_accounts");
    expect(migration).not.toContain("current_balance_minor = current_balance_minor");
  });

  it("scopes every completed replay to the original character and transfer", () => {
    for (const source of [depositSource, withdrawalSource, transferSource]) {
      expect(source).toContain(
        "existing_transaction.created_by_profile_id IS DISTINCT FROM profile_id",
      );
      expect(source).toContain(
        "existing_transaction.source_account_id IS DISTINCT FROM",
      );
      expect(source).toContain(
        "existing_transaction.destination_account_id IS DISTINCT FROM",
      );
      expect(source).toContain(
        "existing_transaction.net_amount_minor IS DISTINCT FROM p_amount_minor",
      );
      expect(source).toContain("RAISE EXCEPTION 'idempotency_key_conflict'");
      expect(source).toContain("'idempotent', true");
    }
  });

  it("serialises operation keys before checking or moving money", () => {
    expect(migration.match(/pg_advisory_xact_lock/g)).toHaveLength(3);
  });

  it("keeps wallet projections whole-unit while bank transfers retain pennies", () => {
    expect(depositSource).toContain("mod(p_amount_minor, 100) <> 0");
    expect(withdrawalSource).toContain("mod(p_amount_minor, 100) <> 0");
    expect(transferSource).not.toContain("mod(p_amount_minor, 100)");
    expect(depositSource).toContain("UPDATE public.profiles");
    expect(withdrawalSource).toContain("UPDATE public.profiles");
    expect(transferSource).not.toContain("UPDATE public.profiles");
  });

  it("checks outgoing bank eligibility for withdrawals and account transfers", () => {
    expect(withdrawalSource).toContain(
      "public.is_bank_account_eligible_for_outgoing_payment(",
    );
    expect(transferSource).toContain(
      "public.is_bank_account_eligible_for_outgoing_payment(",
    );
  });

  it("exposes typed APIs that require caller-owned idempotency keys", () => {
    for (const rpc of [
      "deposit_my_wallet_to_bank",
      "withdraw_my_bank_to_wallet",
      "transfer_between_my_bank_accounts",
    ]) {
      expect(apiSource).toContain(`\"${rpc}\"`);
      expect(migration).toContain(`public.${rpc}`);
    }
    expect(apiSource).toContain("idempotencyKey: string");
    expect(apiSource).not.toContain("crypto.randomUUID");
  });
});
