export type StaffCategory =
  | "manager"
  | "assistant_manager"
  | "customer_service"
  | "sales"
  | "marketing"
  | "finance"
  | "security"
  | "technician"
  | "cleaner"
  | "specialist";

export type EmployeeKind = "npc" | "player";

export interface CompanyFinanceConfig {
  baseWeeklyRevenue: number;
  revenueCap: number;
  propertyCost: number;
  utilitiesCost: number;
  maintenanceCost: number;
  marketingCost: number;
  otherCost: number;
  realPlayerBonusMultiplier: number;
  npcBonusMultiplier: number;
  staffContributionCap: number;
  roleCoverageCap: number;
  randomVariationMin: number;
  randomVariationMax: number;
  unpaidPenaltyRate: number;
}

export interface CompanyFinanceInput {
  balance: number;
  quality: number;
  reputation: number;
  demand: number;
  capacity: number;
  recentPerformance: number;
  employees: CompanyEmployeeInput[];
  config: CompanyFinanceConfig;
  randomVariation?: number;
  recentUnpaidAmount?: number;
}

export interface CompanyEmployeeInput {
  id: string;
  employeeType: EmployeeKind;
  role: StaffCategory;
  weeklyWage: number;
  skillRating: number;
  activityRating?: number;
  suitabilityRating?: number;
  status?: string;
}

export interface WeeklyFinanceResult {
  grossRevenue: number;
  staffWageCosts: number;
  propertyCosts: number;
  utilities: number;
  maintenance: number;
  marketingCosts: number;
  otherCosts: number;
  totalCosts: number;
  netProfit: number;
  balanceBefore: number;
  balanceAfter: number;
  unpaidAmount: number;
  status: "processed" | "processed_with_unpaid_costs";
  modifiers: Record<string, number>;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const DEFAULT_COMPANY_FINANCE_CONFIG: CompanyFinanceConfig = {
  baseWeeklyRevenue: 12_000,
  revenueCap: 75_000,
  propertyCost: 2_500,
  utilitiesCost: 700,
  maintenanceCost: 1_000,
  marketingCost: 0,
  otherCost: 500,
  realPlayerBonusMultiplier: 1.45,
  npcBonusMultiplier: 0.9,
  staffContributionCap: 0.4,
  roleCoverageCap: 0.2,
  randomVariationMin: 0.95,
  randomVariationMax: 1.05,
  unpaidPenaltyRate: 0.08,
};

export function calculateStaffPerformance(employees: CompanyEmployeeInput[], config: CompanyFinanceConfig) {
  const activeEmployees = employees.filter((employee) => (employee.status ?? "active") === "active");
  const roleCounts = new Map<StaffCategory, number>();
  let rawContribution = 0;

  for (const employee of activeEmployees) {
    const duplicateCount = roleCounts.get(employee.role) ?? 0;
    roleCounts.set(employee.role, duplicateCount + 1);

    const skill = clamp(employee.skillRating, 0, 100) / 100;
    const activity = clamp(employee.activityRating ?? (employee.employeeType === "npc" ? 80 : 50), 0, 100) / 100;
    const suitability = clamp(employee.suitabilityRating ?? employee.skillRating, 0, 100) / 100;
    const kindMultiplier = employee.employeeType === "player" ? config.realPlayerBonusMultiplier : config.npcBonusMultiplier;
    const diminishingReturn = 1 / (1 + duplicateCount * 0.65);

    rawContribution += skill * activity * suitability * kindMultiplier * diminishingReturn * 0.12;
  }

  const essentialRoles: StaffCategory[] = ["manager", "customer_service", "sales"];
  const coverage = essentialRoles.filter((role) => (roleCounts.get(role) ?? 0) > 0).length / essentialRoles.length;
  const missingRolePenalty = (1 - coverage) * 0.18;
  const staffContribution = clamp(rawContribution, 0, config.staffContributionCap);
  const roleCoverageBonus = clamp(coverage * config.roleCoverageCap, 0, config.roleCoverageCap);

  return {
    employeeCount: activeEmployees.length,
    staffContribution,
    roleCoverageBonus,
    missingRolePenalty,
    multiplier: clamp(1 + staffContribution + roleCoverageBonus - missingRolePenalty, 0.55, 1.75),
  };
}

export function calculateWeeklyCompanyFinance(input: CompanyFinanceInput): WeeklyFinanceResult {
  const config = input.config;
  const staff = calculateStaffPerformance(input.employees, config);
  const qualityModifier = clamp(input.quality / 100, 0.25, 1.5);
  const reputationModifier = clamp(1 + input.reputation / 400, 0.75, 1.35);
  const demandModifier = clamp(input.demand / 100, 0.35, 1.4);
  const capacityModifier = clamp(input.capacity / 100, 0.4, 1.25);
  const recentPerformanceModifier = clamp(input.recentPerformance / 100, 0.65, 1.25);
  const financialHealthPenalty = clamp((input.recentUnpaidAmount ?? 0) * config.unpaidPenaltyRate / Math.max(config.baseWeeklyRevenue, 1), 0, 0.35);
  const randomVariation = clamp(input.randomVariation ?? 1, config.randomVariationMin, config.randomVariationMax);

  const uncappedRevenue = config.baseWeeklyRevenue * qualityModifier * reputationModifier * demandModifier * capacityModifier * recentPerformanceModifier * staff.multiplier * (1 - financialHealthPenalty) * randomVariation;
  const grossRevenue = Math.round(clamp(uncappedRevenue, 0, config.revenueCap));
  const staffWageCosts = Math.round(input.employees.filter((employee) => (employee.status ?? "active") === "active").reduce((sum, employee) => sum + Math.max(0, employee.weeklyWage), 0));
  const propertyCosts = Math.round(Math.max(0, config.propertyCost));
  const utilities = Math.round(Math.max(0, config.utilitiesCost));
  const maintenance = Math.round(Math.max(0, config.maintenanceCost));
  const marketingCosts = Math.round(Math.max(0, config.marketingCost));
  const otherCosts = Math.round(Math.max(0, config.otherCost));
  const totalCosts = staffWageCosts + propertyCosts + utilities + maintenance + marketingCosts + otherCosts;
  const netProfit = grossRevenue - totalCosts;
  const balanceBefore = Math.round(input.balance);
  const theoreticalAfter = balanceBefore + netProfit;
  const unpaidAmount = Math.max(0, -theoreticalAfter);
  const balanceAfter = Math.max(0, theoreticalAfter);

  return {
    grossRevenue,
    staffWageCosts,
    propertyCosts,
    utilities,
    maintenance,
    marketingCosts,
    otherCosts,
    totalCosts,
    netProfit,
    balanceBefore,
    balanceAfter,
    unpaidAmount,
    status: unpaidAmount > 0 ? "processed_with_unpaid_costs" : "processed",
    modifiers: {
      qualityModifier,
      reputationModifier,
      demandModifier,
      capacityModifier,
      recentPerformanceModifier,
      staffMultiplier: staff.multiplier,
      staffContribution: staff.staffContribution,
      roleCoverageBonus: staff.roleCoverageBonus,
      missingRolePenalty: staff.missingRolePenalty,
      financialHealthPenalty,
      randomVariation,
    },
  };
}
