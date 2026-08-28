import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const bankingSource = fs.readFileSync(
  path.resolve("src/pages/Banking.tsx"),
  "utf8",
);
const apiSource = fs.readFileSync(
  path.resolve("src/lib/api/personalBanking.ts"),
  "utf8",
);

describe("Banking personal-transfer authority and retry contract", () => {
  it("routes account money movements through the typed API", () => {
    for (const operation of [
      "depositWalletToBank",
      "withdrawBankToWallet",
      "transferBetweenBankAccounts",
    ]) {
      expect(bankingSource).toContain(operation);
      expect(apiSource).toContain(`export const ${operation}`);
    }

    expect(bankingSource).not.toContain(
      '(supabase as any).rpc("deposit_my_wallet_to_bank"',
    );
    expect(bankingSource).not.toContain(
      '(supabase as any).rpc("withdraw_my_bank_to_wallet"',
    );
    expect(bankingSource).not.toContain(
      '"transfer_between_my_bank_accounts"',
    );
  });

  it("retains one operation key for network-error retries", () => {
    expect(bankingSource).toContain(
      "const key = idempotencyKey ?? operationKey();",
    );
    expect(bankingSource).toContain(
      "if (!idempotencyKey) setIdempotencyKey(key);",
    );
    expect(bankingSource).toContain('idempotencyKey: key');
    expect(bankingSource).toContain('"Retry safely"');
    expect(bankingSource).toContain('"Retry opening"');
  });

  it("starts a new operation when transfer details change", () => {
    expect(bankingSource).toContain("setIdempotencyKey(null);");
    expect(bankingSource).toContain("setAmount(event.target.value);");
    expect(bankingSource).toContain("setDestinationId(value);");
    expect(bankingSource).toContain("resetOperation();");
  });

  it("surfaces idempotent server results to the player", () => {
    expect(bankingSource).toContain("result.idempotent");
    expect(bankingSource).toContain("was already completed — balances refreshed");
    expect(bankingSource).toContain("A network-error retry will not move the money twice.");
  });

  it("refreshes banking, character cash and finance activity", () => {
    for (const queryKey of [
      'queryKey: ["banking-dashboard"]',
      'queryKey: ["finance-command-center"]',
      'queryKey: ["profile"]',
      'queryKey: ["active-profile"]',
      'queryKey: ["financial-account"]',
      'queryKey: ["financial-transactions"]',
    ]) {
      expect(bankingSource).toContain(queryKey);
    }
  });

  it("scopes dashboard caching to the active character", () => {
    expect(bankingSource).toContain('queryKey: ["banking-dashboard", profileId]');
    expect(bankingSource).toContain("enabled: Boolean(profileId)");
    expect(bankingSource).toContain('refetchOnMount: "always"');
  });

  it("preserves currency rules", () => {
    expect(bankingSource).toContain('summary?.currencyCode ?? "GBP"');
    expect(bankingSource).toContain("amountMinor % 100 === 0");
    expect(bankingSource).toContain(
      "candidate.currencyCode === account.currencyCode",
    );
    expect(bankingSource).toContain(
      "Currency conversion is not performed. Only matching-currency destinations",
    );
  });
});
