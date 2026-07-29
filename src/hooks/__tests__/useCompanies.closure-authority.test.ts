import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve("src/hooks/useCompanies.ts"), "utf8");
const closureStart = source.indexOf("export const useCloseSubsidiary");
const closureSource = closureStart >= 0 ? source.slice(closureStart) : "";

describe("company closure authority boundary", () => {
  it("uses the authoritative closure API", () => {
    expect(source).toContain('import { closeCompany } from "@/lib/api/companyClosure";');
    expect(closureSource).toContain("closeCompany(companyId, transferBalance)");
  });

  it("does not perform browser-side liquidation writes", () => {
    for (const forbidden of [
      '.from("profiles")',
      '.from("companies").delete',
      '.from("company_transactions")',
      '.from("company_settings")',
      '.from("company_tax_records")',
      '.from("security_firms")',
      '.from("merch_factories")',
      '.from("logistics_companies")',
    ]) {
      expect(closureSource).not.toContain(forbidden);
    }
  });

  it("hides dissolved companies from active ownership queries", () => {
    expect(source.match(/\.neq\("status", "dissolved"\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("uses UK currency for liquidation messaging", () => {
    expect(closureSource).toContain('new Intl.NumberFormat("en-GB"');
    expect(closureSource).toContain('currency: "GBP"');
  });
});
