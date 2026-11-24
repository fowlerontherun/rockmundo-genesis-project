import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../../../");
const read = (name: string) => fs.readFileSync(path.join(root, name), "utf8");

describe("company accounting authority", () => {
  const companies = read("src/hooks/useCompanies.ts");
  const finance = read("src/hooks/useCompanyFinance.ts");
  const creation = read("src/components/company/CreateCompanyDialog.tsx");
  const migration = read("supabase/migrations/20261124161151_company_finance_authority_recovery.sql");
  const ownerCapitalMigration = read("supabase/migrations/20261124161158_company_founding_owner_funded_capital.sql");

  it("routes founding and liquidation to authenticated atomic RPCs", () => {
    expect(companies).toContain("await foundCompany(");
    expect(companies).toContain("await closeCompany(");
    expect(companies).not.toMatch(/\.from\("profiles"\)\s*\.update\(/);
    expect(companies).not.toMatch(/\.from\("companies"\)\s*\.insert\(/);
    expect(companies).not.toMatch(/\.from\("company_transactions"\)\s*\.(?:insert|delete)\(/);
    expect(companies).not.toMatch(/\.from\("companies"\)\s*\.delete\(/);
  });

  it("requires owner-funded capital and limits company metadata mutations", () => {
    expect(creation).toContain("costs.creationCost + costs.startingBalance");
    expect(companies).toContain('Pick<Company, "name" | "description" | "logo_url">');
    expect(ownerCapitalMigration).toContain("v_cost+v_starting");
    expect(ownerCapitalMigration).toContain("company-owner-capital:");
  });

  it("excludes owner funding and transfers from operating P&L", () => {
    expect(companies).toContain("recentTxns.filter(isCompanyOperatingIncome)");
    expect(companies).toContain("recentTxns.filter(isCompanyOperatingExpense)");
    expect(finance).toContain("pageSize = 500");
    expect(read("src/components/company/CompanyAnalytics.tsx")).toContain(
      "row.net = row.demandRevenue - row.expenses - row.taxes - row.wages",
    );
  });

  it("blocks raw money, share and dividend writes and preserves closure history", () => {
    expect(migration).toContain("REVOKE INSERT, UPDATE, DELETE ON public.companies");
    expect(migration).toContain("GRANT UPDATE(name, description, logo_url)");
    expect(migration).toContain("REVOKE INSERT, UPDATE, DELETE ON public.company_transactions");
    expect(migration).toContain("REVOKE INSERT, UPDATE, DELETE ON public.company_shares");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.pay_company_dividends");
    expect(migration).toContain("company_finance_reconciliation_required");
    expect(migration).toContain("company_has_outstanding_obligations");
  });
});
