import { describe, expect, it } from "vitest";
import { calculateEmployeePerformance, canWithdrawOwnerFunds, classifyCompanyFinancialHealth, summarizeProfitAndLoss } from "./companyFinanceCalculations";

describe("company finance phase 3 calculations", () => {
  it("caps NPC contribution below an active skilled real-player specialist", () => {
    const npc = calculateEmployeePerformance({ employeeKind: "npc", relevantSkill: 95, reliability: 95, completedExpectationRatio: 1, roleSuitability: 95, companyResourceScore: 80 });
    const player = calculateEmployeePerformance({ employeeKind: "player", relevantSkill: 95, reliability: 95, isActiveThisWeek: true, completedExpectationRatio: 1, roleSuitability: 95, companyResourceScore: 80 });
    expect(npc.score).toBe(72);
    expect(player.score).toBeGreaterThan(npc.score);
    expect(player.score).toBeLessThanOrEqual(95);
  });

  it("reduces inactive real-player employee performance", () => {
    const active = calculateEmployeePerformance({ employeeKind: "player", relevantSkill: 80, reliability: 80, isActiveThisWeek: true });
    const inactive = calculateEmployeePerformance({ employeeKind: "player", relevantSkill: 80, reliability: 80, isActiveThisWeek: false });
    expect(inactive.score).toBeLessThan(active.score);
    expect(inactive.reasons).toContain("Inactive real-player fallback reduced contribution");
  });

  it("keeps profit distinct from owner capital and dividends", () => {
    const pnl = summarizeProfitAndLoss([
      { category: "studio_booking_revenue", amountMinor: 200_00, kind: "revenue" },
      { category: "owner_investment", amountMinor: 1_000_00, kind: "capital" },
      { category: "payroll", amountMinor: 80_00, kind: "payroll" },
      { category: "dividend", amountMinor: 50_00, kind: "dividend" },
    ]);
    expect(pnl.netProfit).toBe(120_00);
    expect(pnl.capitalFlows).toBe(1_000_00);
    expect(pnl.dividends).toBe(50_00);
  });

  it("classifies recoverable payroll distress without jumping to insolvency", () => {
    expect(classifyCompanyFinancialHealth({ availableCashMinor: 50_00, weeklyRecurringExpenseMinor: 500_00, overdueLiabilitiesMinor: 0, unpaidPayrollMinor: 400_00, negativeCashFlowWeeks: 1, failedPayrollRuns: 1 })).toBe("delinquent");
  });

  it("blocks owner withdrawals while payroll or reserves are at risk", () => {
    const result = canWithdrawOwnerFunds({ availableCashMinor: 900_00, requestedMinor: 500_00, reserveTargetMinor: 600_00, unpaidPayrollMinor: 100_00, overdueLiabilitiesMinor: 0, health: "payroll_risk" });
    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain("Critical payroll remains unpaid");
    expect(result.blockers).toContain("Withdrawal would breach the company cash reserve target");
  });
});
