import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFestivalBudgetForecast } from "./model";

const source = (path: string) => readFileSync(path, "utf8");
const migration = source(
  "supabase/migrations/20291218250400_simplified_festival_automatic_sponsorship_budget.sql",
);

describe("simplified Festival automatic sponsorship budget", () => {
  it("parses the owner budget forecast including automatic sponsorship", () => {
    const parsed = parseFestivalBudgetForecast({
      festivalCompanyId: "11111111-1111-4111-8111-111111111111",
      festivalEditionId: "22222222-2222-4222-8222-222222222222",
      currencyCode: "GBP",
      expectedTicketsSold: 767,
      expectedAttendance: 736,
      ticketRevenueMinor: 2323972,
      sponsorshipRevenueMinor: 260000,
      foodAndDrinkRevenueMinor: 883200,
      merchandiseRevenueMinor: 368000,
      totalRevenueMinor: 3835172,
      operatingCostMinor: 2618834,
      projectedNetProfitMinor: 1216338,
      projectionSource: "simplified_budget_v1",
      sponsorshipMode: "automatic",
    });

    expect(parsed.sponsorshipRevenueMinor).toBe(260000);
    expect(parsed.projectedNetProfitMinor).toBe(1216338);
    expect(parsed.sponsorshipMode).toBe("automatic");
  });

  it("keeps sponsorship server-owned and driven by Festival progression", () => {
    expect(migration).toContain("_festival_automatic_sponsorship_minor");
    expect(migration).toContain("marketingDemandBasisPoints");
    expect(migration).toContain("reputation_score");
    expect(migration).toContain("marketing_media");
    expect(migration).toContain("v_expected_capacity::bigint * 250");
    expect(migration).toContain("v_operating_cost_minor::numeric * 0.35");
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\._festival_automatic_sponsorship_minor\(uuid, uuid\) FROM PUBLIC, anon, authenticated/i,
    );
  });

  it("exposes only an authorised owner budget RPC", () => {
    expect(migration).toContain("get_festival_edition_budget_forecast");
    expect(migration).toContain("_festival_company_manager_authorized");
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.get_festival_edition_budget_forecast\(uuid, uuid\) FROM PUBLIC, anon/i,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_festival_edition_budget_forecast\(uuid, uuid\) TO authenticated, service_role/i,
    );
  });

  it("uses sponsorship in the authoritative completed Festival settlement", () => {
    expect(migration).toContain(
      "sponsorship:=public._festival_automatic_sponsorship_minor",
    );
    expect(migration).toContain(
      "total_revenue:=actual_ticket_net+sponsorship+food+merch",
    );
    expect(migration).toContain("'sponsorshipRevenueMinor',sponsorship");
    expect(migration).toContain("'simplified-festival-results-v2'");
  });

  it("shows budget and sponsorship in the simplified owner UI", () => {
    const planner = source(
      "src/features/festival-company/ui/FestivalTicketPlanner.tsx",
    );
    const budget = source(
      "src/features/festivals/budget/FestivalBudgetForecast.tsx",
    );
    const sections = source(
      "src/features/festivals/ui/FestivalEditionSections.tsx",
    );
    const ticketQuery = source(
      "src/features/festival-company/application/useFestivalTicketPlan.ts",
    );

    expect(planner).toContain("<FestivalBudgetForecast");
    expect(budget).toContain("Automatic sponsorship");
    expect(budget).toContain("Projected result");
    expect(sections).toContain('label="Sponsorship"');
    expect(ticketQuery).toContain("festivalBudgetForecastQueryKey");
  });
});
