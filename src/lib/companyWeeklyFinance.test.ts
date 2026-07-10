import { describe, expect, it } from "vitest";
import { DEFAULT_COMPANY_FINANCE_CONFIG, calculateStaffPerformance, calculateWeeklyCompanyFinance } from "./companyWeeklyFinance";

const config = { ...DEFAULT_COMPANY_FINANCE_CONFIG, baseWeeklyRevenue: 10000, revenueCap: 50000 };

describe("company weekly finance", () => {
  it("calculates weekly profit and credits company balance", () => {
    const result = calculateWeeklyCompanyFinance({ balance: 20000, quality: 90, reputation: 80, demand: 100, capacity: 100, recentPerformance: 100, randomVariation: 1, config, employees: [
      { id: "p1", employeeType: "player", role: "manager", weeklyWage: 1500, skillRating: 90, activityRating: 100, suitabilityRating: 95 },
      { id: "n1", employeeType: "npc", role: "sales", weeklyWage: 900, skillRating: 70 },
    ]});
    expect(result.grossRevenue).toBeGreaterThan(result.totalCosts);
    expect(result.balanceAfter).toBe(result.balanceBefore + result.netProfit);
    expect(result.status).toBe("processed");
  });

  it("calculates weekly loss without overdrawing unsupported balances", () => {
    const result = calculateWeeklyCompanyFinance({ balance: 1000, quality: 20, reputation: -50, demand: 35, capacity: 40, recentPerformance: 50, randomVariation: 0.95, config, employees: [
      { id: "n1", employeeType: "npc", role: "cleaner", weeklyWage: 5000, skillRating: 40 },
    ]});
    expect(result.netProfit).toBeLessThan(0);
    expect(result.unpaidAmount).toBeGreaterThan(0);
    expect(result.balanceAfter).toBe(0);
    expect(result.status).toBe("processed_with_unpaid_costs");
  });

  it("gives qualified active real players a stronger capped maximum than NPCs", () => {
    const npc = calculateStaffPerformance([{ id: "n", employeeType: "npc", role: "manager", weeklyWage: 1000, skillRating: 100, activityRating: 100, suitabilityRating: 100 }], config);
    const player = calculateStaffPerformance([{ id: "p", employeeType: "player", role: "manager", weeklyWage: 1000, skillRating: 100, activityRating: 100, suitabilityRating: 100 }], config);
    expect(player.staffContribution).toBeGreaterThan(npc.staffContribution);
    expect(player.staffContribution).toBeLessThanOrEqual(config.staffContributionCap);
  });

  it("does not let unqualified inactive players automatically outperform NPCs", () => {
    const npc = calculateStaffPerformance([{ id: "n", employeeType: "npc", role: "sales", weeklyWage: 1000, skillRating: 70 }], config);
    const player = calculateStaffPerformance([{ id: "p", employeeType: "player", role: "sales", weeklyWage: 1000, skillRating: 20, activityRating: 20, suitabilityRating: 25 }], config);
    expect(player.staffContribution).toBeLessThan(npc.staffContribution);
  });

  it("applies diminishing returns to duplicate roles", () => {
    const one = calculateStaffPerformance([{ id: "p1", employeeType: "player", role: "marketing", weeklyWage: 1000, skillRating: 80, activityRating: 90, suitabilityRating: 90 }], config);
    const many = calculateStaffPerformance(Array.from({ length: 8 }, (_, index) => ({ id: `p${index}`, employeeType: "player" as const, role: "marketing" as const, weeklyWage: 1000, skillRating: 80, activityRating: 90, suitabilityRating: 90 })), config);
    expect(many.staffContribution).toBeLessThanOrEqual(config.staffContributionCap);
    expect(many.staffContribution).toBeLessThan(one.staffContribution * 8);
  });
});
