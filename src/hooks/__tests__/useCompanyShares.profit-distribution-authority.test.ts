import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve("src/hooks/useCompanyShares.ts"), "utf8");
const distributionStart = source.indexOf("export const useDistributeAnnualProfit");
const distributionSource = distributionStart >= 0 ? source.slice(distributionStart) : "";

describe("company annual profit distribution authority boundary", () => {
  it("uses the typed authoritative distribution API", () => {
    expect(source).toContain(
      'import { distributeCompanyAnnualProfit } from "@/lib/api/companyProfitDistributions";',
    );
    expect(distributionSource).toContain("distributeCompanyAnnualProfit(companyId)");
  });

  it("does not calculate or write shareholder payouts in the browser", () => {
    expect(distributionSource).not.toContain("supabase");
    expect(distributionSource).not.toContain("calculateInGameDate");

    for (const forbidden of [
      '.from("profiles")',
      '.from("companies")',
      '.from("company_transactions")',
      '.from("company_profit_distributions")',
      '.from("company_shareholders")',
      ".update(",
      ".insert(",
    ]) {
      expect(distributionSource).not.toContain(forbidden);
    }
  });

  it("refreshes company and shareholder finance views", () => {
    for (const queryKey of [
      '"company-balance"',
      '"company-transactions"',
      '"company-income-expenses"',
      '"company-shareholders"',
      '"company-financial-summary"',
      '"user-cash-balance"',
      '"financial-ledger-history"',
    ]) {
      expect(distributionSource).toContain(queryKey);
    }
  });

  it("uses UK pound formatting", () => {
    expect(source).toContain('new Intl.NumberFormat("en-GB"');
    expect(source).toContain('currency: "GBP"');
  });
});
