import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("simplified Festival Results contract", () => {
  it("uses a private owner Results RPC for financial and company impact", () => {
    const repository = source("src/features/festivals/settlement/repository.ts");
    const results = source("src/features/festivals/settlement/simplifiedResults.ts");
    const ui = source("src/features/festivals/ui/FestivalEditionSections.tsx");

    expect(repository).toContain("get_festival_edition_results");
    expect(repository).toContain("ownerHistory");
    expect(results).toContain("netProfitMinor");
    expect(results).toContain("balanceAfterMinor");
    expect(results).toContain("reputationAfter");
    expect(ui).toContain("Festival finances");
    expect(ui).toContain("Company impact");
    expect(ui).toContain("Balance before");
    expect(ui).toContain("Balance after");
  });

  it("keeps company settlement automatic and idempotent", () => {
    const schema = source(
      "supabase/reconciliation/festival/20260822_simplified_festival_company_settlement_schema.sql",
    );
    const effects = source(
      "supabase/reconciliation/festival/20260822_simplified_festival_company_effects.sql",
    );

    expect(schema).toContain("uq_company_transactions_simplified_festival_result");
    expect(schema).toContain("settlement_applied_at");
    expect(effects).toContain("festival_apply_simplified_company_effects");
    expect(effects).toContain("AFTER INSERT ON public.festival_simplified_edition_results");
    expect(effects).toContain("v_balance_after_minor := v_balance_before_minor + v_result.net_profit_minor");
    expect(effects).toContain("reputation_score = v_reputation_after");
    expect(effects).toContain("category = 'festival_settlement'");
  });

  it("separates private owner finances from public history", () => {
    const api = source(
      "supabase/reconciliation/festival/20260822_simplified_festival_results_api.sql",
    );
    const ownerStart = api.indexOf("CREATE OR REPLACE FUNCTION public.get_festival_edition_results");
    const publicStart = api.indexOf("CREATE OR REPLACE FUNCTION public.get_public_festival_edition_history");
    const ownerDefinition = api.slice(ownerStart, publicStart);
    const publicDefinition = api.slice(publicStart);

    expect(ownerDefinition).toContain("'financials'");
    expect(ownerDefinition).toContain("'netProfitMinor'");
    expect(ownerDefinition).toContain("'companyImpact'");
    expect(publicDefinition).not.toContain("'netProfitMinor'");
    expect(publicDefinition).not.toContain("'totalRevenueMinor'");
    expect(publicDefinition).not.toContain("'companyTransactionId'");
  });
});
