import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20291218242310_harden_financial_transfer_idempotency.sql",
  ),
  "utf8",
);

describe("canonical financial transfer idempotency", () => {
  it("serialises every movement on the raw globally unique key", () => {
    expect(migration).toContain(
      "pg_advisory_xact_lock(hashtextextended(p_key, 0))",
    );
    expect(migration).not.toContain("wallet-bank-deposit:");
    expect(migration).not.toContain("bank-wallet-withdrawal:");
    expect(migration).not.toContain("bank-account-transfer:");
  });

  it("returns an existing transaction only for the same actor and movement", () => {
    for (const assertion of [
      "existing_transaction.status <> 'completed'",
      "existing_transaction.created_by_profile_id IS DISTINCT FROM p_profile",
      "existing_transaction.source_account_id IS DISTINCT FROM p_source",
      "existing_transaction.destination_account_id IS DISTINCT FROM p_destination",
      "existing_transaction.net_amount_minor IS DISTINCT FROM p_amount",
      "RAISE EXCEPTION 'idempotency_key_conflict'",
    ]) {
      expect(migration).toContain(assertion);
    }
  });

  it("locks accounts deterministically and rejects invalid movements", () => {
    expect(migration).toContain("WHERE id IN (p_source, p_destination)");
    expect(migration).toContain("ORDER BY id");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("RAISE EXCEPTION 'account_not_active'");
    expect(migration).toContain("RAISE EXCEPTION 'currency_mismatch_no_conversion'");
    expect(migration).toContain("RAISE EXCEPTION 'insufficient_funds'");
  });

  it("writes one completed transaction and two balanced ledger entries", () => {
    expect(migration).toContain("INSERT INTO public.financial_transactions");
    expect(migration).toContain("INSERT INTO public.financial_ledger_entries");
    expect(migration).toContain("'debit'");
    expect(migration).toContain("'credit'");
    expect(migration).toContain("source_account.current_balance_minor - p_amount");
    expect(migration).toContain(
      "destination_account.current_balance_minor + p_amount",
    );
  });

  it("keeps the primitive private from browser roles", () => {
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("TO service_role");
  });
});
