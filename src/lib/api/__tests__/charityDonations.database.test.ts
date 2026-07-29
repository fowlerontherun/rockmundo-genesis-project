import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(file), "utf8");

const categoryMigration = read(
  "supabase/migrations/20291218242500_add_charity_donation_transaction_category.sql",
);
const migration = read(
  "supabase/migrations/20291218242600_atomic_charity_donations.sql",
);
const apiSource = read("src/lib/api/charityDonations.ts");
const componentSource = read("src/components/finance/CharityDonationsTab.tsx");

describe("atomic character charity donations", () => {
  it("uses a dedicated canonical transaction category", () => {
    expect(categoryMigration).toContain("ADD VALUE IF NOT EXISTS 'charity_donation'");
    expect(migration).toContain("public._move_financial_account_money(");
    expect(migration).toContain("'charity_donation'");
    expect(migration).toContain("'charity_clearing'");
  });

  it("derives authority, wallet and currency on the server", () => {
    expect(migration).toContain("public.current_active_player_profile_id()");
    expect(migration).toContain("owner_type = 'player'");
    expect(migration).toContain("AND is_primary");
    expect(migration).toContain("COALESCE(wallet.currency_code, wallet.default_currency_code)");
    expect(migration).toContain("donation_amount_must_be_whole_major_units");
  });

  it("is idempotent and links every canonical donation to the ledger", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("charity_donations_idempotency_unique_idx");
    expect(migration).toContain("financial_transaction_id");
    expect(migration).toContain("idempotency_key_conflict");
    expect(migration).toContain("'idempotent', true");
  });

  it("calculates and applies rewards in the same transaction", () => {
    expect(migration).toContain("charity.fame_bonus_pct");
    expect(migration).toContain("charity.reputation_boost");
    expect(migration).toContain("fame = COALESCE(fame, 0) + fame_reward");
    expect(migration).toContain("attitude_score = new_attitude");
    expect(migration).toContain("INSERT INTO public.reputation_events");
    expect(migration).toContain("LEAST(100");
  });

  it("prevents the old direct donation write path", () => {
    expect(migration).toContain('DROP POLICY IF EXISTS "Users can insert own donations"');
    expect(migration).toContain("REVOKE INSERT, UPDATE, DELETE");
    expect(componentSource).not.toContain('.from("profiles")');
    expect(componentSource).not.toContain('.from("charity_donations").insert');
    expect(componentSource).toContain("makeCharityDonation");
  });

  it("exposes one typed RPC using minor units and a caller idempotency key", () => {
    expect(apiSource).toContain('"make_my_charity_donation"');
    expect(apiSource).toContain("p_amount_minor: amountMinor");
    expect(apiSource).toContain("p_idempotency_key: idempotencyKey");
    expect(apiSource).toContain("CharityDonationResult");
  });
});
