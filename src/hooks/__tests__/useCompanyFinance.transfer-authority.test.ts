import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve("src/hooks/useCompanyFinance.ts"), "utf8");
const start = source.indexOf("export const useDepositToCompany");
const authority = start >= 0 ? source.slice(start) : "";

describe("company fund transfer authority boundary", () => {
  it("uses the authoritative transfer API for all three flows", () => {
    expect(source).toContain('import { transferCompanyFunds } from "@/lib/api/companyFundTransfers";');
    expect(authority).toContain('transferKind: "deposit"');
    expect(authority).toContain('transferKind: "withdrawal"');
    expect(authority).toContain('transferKind: "intercompany"');
  });

  it("does not write money mirrors from the browser", () => {
    for (const forbidden of [
      "financeService.transfer(",
      '.from("profiles")',
      '.from("companies")\n        .update',
      '.from("company_transactions")\n        .insert',
    ]) expect(authority).not.toContain(forbidden);
  });

  it("uses UK currency formatting", () => {
    expect(source).toContain('new Intl.NumberFormat("en-GB"');
    expect(source).toContain('currency: "GBP"');
  });
});
