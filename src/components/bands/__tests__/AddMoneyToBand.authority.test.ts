import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const componentSource = fs.readFileSync(
  path.resolve("src/components/bands/AddMoneyToBand.tsx"),
  "utf8",
);
const migrationSource = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20291218241000_repair_character_banking_and_band_funding.sql",
  ),
  "utf8",
);

describe("character banking and direct band funding repair", () => {
  it("keeps direct wallet-to-band funding on the authoritative RPCs", () => {
    expect(componentSource).toContain('"get_my_band_funding_sources"');
    expect(componentSource).toContain('"preview_my_band_funding"');
    expect(componentSource).toContain('"fund_my_band"');

    for (const legacyRpc of [
      "deposit_to_band_treasury",
      "contribute_my_personal_funds_to_band",
      "bank_deposit_from_cash",
    ]) {
      expect(componentSource).not.toContain(legacyRpc);
    }
  });

  it("prefers an eligible character wallet and blocks ineligible sources", () => {
    expect(componentSource).toContain(
      'eligibleSources.find((candidate) => candidate.sourceKind === "wallet")',
    );
    expect(componentSource).toContain("!!source?.eligible");
    expect(componentSource).toContain("disabled={!candidate.eligible}");
    expect(componentSource).toContain("Opening a bank account first is not required");
  });

  it("preserves one idempotency key from preview through confirmation", () => {
    expect(componentSource).toContain("setConfirmationKey(crypto.randomUUID())");
    expect(componentSource).toContain("p_idempotency_key: confirmationKey");
  });

  it("derives new bank-account currency from the active wallet", () => {
    expect(migrationSource).toContain(
      "v_currency := coalesce(v_wallet.currency_code, v_wallet.default_currency_code)",
    );
    expect(migrationSource).toContain("AND v_currency = ANY(supported_currencies)");
    expect(migrationSource).not.toContain(
      "AND coalesce(currency_code,default_currency_code)=p_currency_code",
    );
  });

  it("backfills and automatically seeds finance permissions for every band", () => {
    expect(migrationSource).toContain("ensure_band_finance_defaults");
    expect(migrationSource).toContain("trg_seed_band_finance_defaults");
    expect(migrationSource).toContain("SELECT public.ensure_band_finance_defaults(id)");
    expect(migrationSource).toContain("('member', 'make_voluntary_contributions')");
  });
});
