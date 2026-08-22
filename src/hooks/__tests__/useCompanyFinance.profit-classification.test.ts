import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve("src/hooks/useCompanyFinance.ts"), "utf8");
const migration = fs.readFileSync(
  path.resolve("supabase/migrations/20260822134500_fix_company_tax_finance_balances.sql"),
  "utf8",
);

describe("company profit classification", () => {
  it("classifies operating income and expenses by transaction type rather than amount sign", () => {
    expect(source).toContain('transaction.transaction_type === "income"');
    expect(source).toContain('["expense", "salary"].includes(transaction.transaction_type)');
    expect(source).not.toContain("txns.filter(t => t.amount > 0)");
    expect(source).not.toContain("txns.filter(t => t.amount < 0)");
  });

  it("taxes closed-period operating profit and excludes tax payments", () => {
    expect(migration).toContain("v_period := to_char(v_period_start,'YYYY-MM')");
    expect(migration).toContain("ct.transaction_type='income'");
    expect(migration).toContain("ct.transaction_type IN ('expense','salary')");
    expect(migration).toContain("ABS(ct.amount)");
    expect(migration).toContain("COALESCE(ct.category,'') <> 'tax'");
    expect(migration).not.toContain("Fall back to the last 30 days");
  });

  it("does not apply corporation tax to daily gross demand revenue", () => {
    expect(migration).toContain("combined_tax:=LEAST(GREATEST(sales_tax,0),0.95)");
    expect(migration).toContain("base_tax_rate=0");
  });
});
