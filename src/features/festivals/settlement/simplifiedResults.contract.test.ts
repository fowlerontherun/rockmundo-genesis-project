import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSimplifiedFestivalResults } from "./simplifiedResults";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("simplified Festival Results contract", () => {
  it("uses a private owner Results RPC for financial and company impact", () => {
    const repository = source("src/features/festivals/settlement/repository.ts");
    const results = source("src/features/festivals/settlement/simplifiedResults.ts");
    const ui = source("src/features/festivals/ui/FestivalEditionSections.tsx");

    expect(repository).toContain("get_festival_edition_results");
    expect(repository).toContain("ownerHistory");
    expect(results).toContain("sponsorshipRevenueMinor");
    expect(results).toContain("netProfitMinor");
    expect(results).toContain("balanceAfterMinor");
    expect(results).toContain("reputationAfter");
    expect(ui).toContain("Festival finances");
    expect(ui).toContain('label="Sponsorship"');
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

  it("reconciles final finance and converts verified C8 attendance into bounded progression", () => {
    const authority = source(
      "supabase/reconciliation/festival/20260903_festival_finance_engagement_authority.sql",
    );
    const api = source(
      "supabase/reconciliation/festival/20260903_festival_finance_engagement_results_api.sql",
    );

    expect(authority).toContain("festival_simplified_finance_ledger");
    expect(authority).toContain("UNIQUE(festival_result_id,line_key)");
    expect(authority).toContain("FESTIVAL_SIMPLIFIED_FINANCE_LEDGER_MISMATCH");
    expect(authority).toContain("_festival_c8_recalculate_real_attendance_signal");
    expect(authority).toContain("owner_boost_percent");
    expect(authority).toContain("'ticketCountUsed',false");
    expect(authority).toContain("zz_festival_finalise_owner_engagement");
    expect(authority).toContain("engagement_reputation_bonus");
    expect(api).toContain("'ledgerReconciled'");
    expect(api).toContain("'engagementReputationBonus'");
    expect(api).toContain("'realAttendance'");
  });

  it("parses reconciled finance and real-attendance evidence", () => {
    const result = parseSimplifiedFestivalResults({
      festivalName: "Test Festival",
      editionYear: 2026,
      dates: null,
      location: null,
      lineup: [],
      headliners: [],
      publishedSchedule: [],
      attendance: 2500,
      audienceScore: 82,
      profitabilityBand: "profitable",
      completedAt: "2026-09-04T23:00:00Z",
      currencyCode: "GBP",
      financials: {
        ticketRevenueMinor: 1000000,
        sponsorshipRevenueMinor: 150000,
        foodAndDrinkRevenueMinor: 200000,
        merchandiseRevenueMinor: 100000,
        operatingCostMinor: 900000,
        taxMinor: 100000,
        totalRevenueMinor: 1450000,
        netProfitMinor: 550000,
        ledgerFrozenAt: "2026-09-04T23:00:01Z",
        ledgerReconciled: true,
      },
      companyImpact: {
        settlementApplied: true,
        settlementAppliedAt: "2026-09-04T23:00:01Z",
        companyTransactionId: "00000000-0000-4000-8000-000000000001",
        balanceBeforeMinor: 5000000,
        balanceAfterMinor: 5550000,
        reputationBefore: 20,
        reputationAfter: 28,
        baseReputationChange: 5,
        engagementReputationBonus: 3,
        reputationChange: 8,
        engagementFinalised: true,
        engagementFinalisedAt: "2026-09-04T23:15:00Z",
        realAttendance: {
          calculationVersion: "festival-c8-v1",
          verifiedCheckedIn: 15,
          verifiedCompleted: 12,
          completedActivities: 30,
          resolvedMoments: 8,
          engagementPoints: 442,
          ownerBoostPercent: 4.42,
          reputationBonus: 3,
          ticketCountUsed: false,
        },
      },
    });

    expect(result?.financials.ledgerReconciled).toBe(true);
    expect(result?.companyImpact.engagementReputationBonus).toBe(3);
    expect(result?.companyImpact.reputationChange).toBe(8);
    expect(result?.companyImpact.realAttendance.verifiedCompleted).toBe(12);
    expect(result?.companyImpact.realAttendance.ticketCountUsed).toBe(false);
  });

  it("separates private owner finances from public history", () => {
    const api = source(
      "supabase/reconciliation/festival/20260903_festival_finance_engagement_results_api.sql",
    );
    const ownerStart = api.indexOf("CREATE OR REPLACE FUNCTION public.get_festival_edition_results");
    const publicStart = api.indexOf("CREATE OR REPLACE FUNCTION public.get_public_festival_edition_history");
    const ownerDefinition = api.slice(ownerStart, publicStart);
    const publicDefinition = api.slice(publicStart);

    expect(ownerDefinition).toContain("'financials'");
    expect(ownerDefinition).toContain("'netProfitMinor'");
    expect(ownerDefinition).toContain("'companyImpact'");
    expect(publicDefinition).not.toContain("'financials'");
    expect(publicDefinition).not.toContain("'netProfitMinor'");
    expect(publicDefinition).not.toContain("'totalRevenueMinor'");
    expect(publicDefinition).not.toContain("'companyTransactionId'");
  });
});
