export type EmployeeKind = "npc" | "player";
export type FinancialHealth = "healthy" | "watch" | "cash_constrained" | "payroll_risk" | "delinquent" | "critical" | "insolvent";

export interface EmployeePerformanceInput {
  employeeKind: EmployeeKind;
  relevantSkill: number;
  reliability: number;
  isActiveThisWeek?: boolean;
  completedExpectationRatio?: number;
  roleSuitability?: number;
  companyResourceScore?: number;
}

export interface EmployeePerformanceResult {
  score: number;
  band: "low" | "developing" | "solid" | "strong" | "exceptional";
  qualityContribution: number;
  revenueContribution: number;
  costEfficiencyContribution: number;
  customerSatisfactionContribution: number;
  reasons: string[];
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));

export function calculateEmployeePerformance(input: EmployeePerformanceInput): EmployeePerformanceResult {
  const relevantSkill = clamp(input.relevantSkill);
  const reliability = clamp(input.reliability);
  const expectation = Math.max(0, Math.min(1, input.completedExpectationRatio ?? (input.isActiveThisWeek ? 1 : 0.45)));
  const suitability = clamp(input.roleSuitability ?? relevantSkill);
  const resources = clamp(input.companyResourceScore ?? 55);
  const kindCap = input.employeeKind === "player" ? 95 : 72;
  const activityMultiplier = input.employeeKind === "player" ? (input.isActiveThisWeek ? 1.08 : 0.62) : 1;
  const base = relevantSkill * 0.35 + reliability * 0.2 + suitability * 0.2 + resources * 0.1 + expectation * 100 * 0.15;
  const score = Math.min(kindCap, clamp(base * activityMultiplier));
  const reasons = [
    `${input.employeeKind === "player" ? "Real-player" : "NPC"} effectiveness cap: ${kindCap}`,
    `Relevant skill ${relevantSkill}/100`,
    `Reliability ${reliability}/100`,
    `Expectation completion ${Math.round(expectation * 100)}%`,
  ];
  if (input.employeeKind === "player" && !input.isActiveThisWeek) reasons.push("Inactive real-player fallback reduced contribution");
  const diminishing = Math.sqrt(score / 100);
  return {
    score,
    band: score >= 85 ? "exceptional" : score >= 70 ? "strong" : score >= 55 ? "solid" : score >= 40 ? "developing" : "low",
    qualityContribution: Number((diminishing * 8).toFixed(2)),
    revenueContribution: Number((diminishing * 5).toFixed(2)),
    costEfficiencyContribution: Number((diminishing * 3).toFixed(2)),
    customerSatisfactionContribution: Number((diminishing * 6).toFixed(2)),
    reasons,
  };
}

export interface CompanyHealthInput {
  availableCashMinor: number;
  weeklyRecurringExpenseMinor: number;
  overdueLiabilitiesMinor: number;
  unpaidPayrollMinor: number;
  negativeCashFlowWeeks: number;
  failedPayrollRuns: number;
}

export function classifyCompanyFinancialHealth(input: CompanyHealthInput): FinancialHealth {
  const weekly = Math.max(1, input.weeklyRecurringExpenseMinor);
  const runwayWeeks = input.availableCashMinor / weekly;
  if (input.availableCashMinor < 0 || (input.overdueLiabilitiesMinor > weekly * 4 && runwayWeeks < 0.25)) return "insolvent";
  if (input.unpaidPayrollMinor > 0 && input.failedPayrollRuns >= 3) return "critical";
  if (input.overdueLiabilitiesMinor > 0 || input.failedPayrollRuns > 0) return "delinquent";
  if (input.unpaidPayrollMinor > 0 || runwayWeeks < 1) return "payroll_risk";
  if (runwayWeeks < 2) return "cash_constrained";
  if (runwayWeeks < 4 || input.negativeCashFlowWeeks >= 2) return "watch";
  return "healthy";
}

export interface ProfitAndLossLine { category: string; amountMinor: number; kind: "revenue" | "cost_of_sales" | "payroll" | "operating_expense" | "fee" | "capital" | "dividend"; }
export function summarizeProfitAndLoss(lines: ProfitAndLossLine[]) {
  const sum = (kind: ProfitAndLossLine["kind"]) => lines.filter((line) => line.kind === kind).reduce((total, line) => total + line.amountMinor, 0);
  const revenue = sum("revenue");
  const costOfSales = sum("cost_of_sales");
  const payroll = sum("payroll");
  const operatingExpenses = sum("operating_expense");
  const fees = sum("fee");
  const grossProfit = revenue - costOfSales;
  const operatingProfit = grossProfit - payroll - operatingExpenses;
  return {
    revenue,
    costOfSales,
    grossProfit,
    payroll,
    operatingExpenses,
    fees,
    netProfit: operatingProfit - fees,
    capitalFlows: sum("capital"),
    dividends: sum("dividend"),
  };
}

export function canWithdrawOwnerFunds(input: { availableCashMinor: number; requestedMinor: number; reserveTargetMinor: number; unpaidPayrollMinor: number; overdueLiabilitiesMinor: number; health: FinancialHealth }) {
  const blockers: string[] = [];
  if (input.requestedMinor <= 0) blockers.push("Withdrawal amount must be positive");
  if (input.unpaidPayrollMinor > 0) blockers.push("Critical payroll remains unpaid");
  if (input.overdueLiabilitiesMinor > 0) blockers.push("Overdue liabilities must be resolved first");
  if (["critical", "insolvent", "delinquent"].includes(input.health)) blockers.push("Company financial distress blocks owner withdrawals");
  if (input.availableCashMinor - input.requestedMinor < input.reserveTargetMinor) blockers.push("Withdrawal would breach the company cash reserve target");
  return { allowed: blockers.length === 0, blockers };
}
