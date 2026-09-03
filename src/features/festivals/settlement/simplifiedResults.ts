export interface SimplifiedFestivalFinancials {
  ticketRevenueMinor: number;
  sponsorshipRevenueMinor: number;
  foodAndDrinkRevenueMinor: number;
  merchandiseRevenueMinor: number;
  operatingCostMinor: number;
  taxMinor: number;
  totalRevenueMinor: number;
  netProfitMinor: number;
  ledgerFrozenAt: string | null;
  ledgerReconciled: boolean;
}

export interface SimplifiedFestivalRealAttendance {
  calculationVersion?: string;
  verifiedCheckedIn?: number;
  verifiedCompleted?: number;
  completedActivities?: number;
  resolvedMoments?: number;
  engagementPoints?: number;
  ownerBoostPercent?: number;
  reputationBonus?: number;
  ticketCountUsed?: boolean;
}

export interface SimplifiedFestivalCompanyImpact {
  settlementApplied: boolean;
  settlementAppliedAt: string | null;
  companyTransactionId: string | null;
  balanceBeforeMinor: number | null;
  balanceAfterMinor: number | null;
  reputationBefore: number | null;
  reputationAfter: number | null;
  baseReputationChange: number;
  engagementReputationBonus: number;
  reputationChange: number;
  engagementFinalised: boolean;
  engagementFinalisedAt: string | null;
  realAttendance: SimplifiedFestivalRealAttendance;
}

export interface SimplifiedFestivalResults {
  festivalName: string;
  editionYear: number | null;
  dates: { startsOn?: string; endsOn?: string } | null;
  location: unknown;
  lineup: unknown[];
  headliners: unknown[];
  publishedSchedule: unknown[];
  attendance: number;
  audienceScore: number;
  profitabilityBand: string;
  completedAt: string;
  currencyCode: string;
  financials: SimplifiedFestivalFinancials;
  companyImpact: SimplifiedFestivalCompanyImpact;
}

const asObject = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${label} response`);
  }
  return value as Record<string, unknown>;
};

const requiredString = (object: Record<string, unknown>, key: string) => {
  const value = object[key];
  if (typeof value !== "string") throw new Error(`Invalid response field: ${key}`);
  return value;
};

const nullableString = (value: unknown) => {
  if (value === null) return null;
  if (typeof value !== "string") throw new Error("Invalid nullable string response field");
  return value;
};

const requiredNumber = (object: Record<string, unknown>, key: string) => {
  const value = object[key];
  if (typeof value !== "number") throw new Error(`Invalid response field: ${key}`);
  return value;
};

const optionalNumber = (value: unknown) => {
  if (value === undefined) return undefined;
  if (typeof value !== "number") throw new Error("Invalid optional numeric response field");
  return value;
};

const optionalString = (value: unknown) => {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error("Invalid optional string response field");
  return value;
};

const nullableNumber = (value: unknown) => {
  if (value === null) return null;
  if (typeof value !== "number") throw new Error("Invalid nullable numeric response field");
  return value;
};

const requiredArray = (object: Record<string, unknown>, key: string) => {
  const value = object[key];
  if (!Array.isArray(value)) throw new Error(`Invalid response field: ${key}`);
  return value;
};

const parseRealAttendance = (value: unknown): SimplifiedFestivalRealAttendance => {
  const realAttendance = asObject(value, "Festival real attendance");
  return {
    calculationVersion: optionalString(realAttendance.calculationVersion),
    verifiedCheckedIn: optionalNumber(realAttendance.verifiedCheckedIn),
    verifiedCompleted: optionalNumber(realAttendance.verifiedCompleted),
    completedActivities: optionalNumber(realAttendance.completedActivities),
    resolvedMoments: optionalNumber(realAttendance.resolvedMoments),
    engagementPoints: optionalNumber(realAttendance.engagementPoints),
    ownerBoostPercent: optionalNumber(realAttendance.ownerBoostPercent),
    reputationBonus: optionalNumber(realAttendance.reputationBonus),
    ticketCountUsed:
      typeof realAttendance.ticketCountUsed === "boolean"
        ? realAttendance.ticketCountUsed
        : undefined,
  };
};

export function parseSimplifiedFestivalResults(value: unknown): SimplifiedFestivalResults | null {
  if (value === null) return null;

  const result = asObject(value, "simplified Festival Results");
  const financials = asObject(result.financials, "Festival financials");
  const companyImpact = asObject(result.companyImpact, "Festival company impact");
  const dates = result.dates === null
    ? null
    : (asObject(result.dates, "Festival dates") as SimplifiedFestivalResults["dates"]);

  return {
    festivalName: requiredString(result, "festivalName"),
    editionYear: nullableNumber(result.editionYear),
    dates,
    location: result.location,
    lineup: requiredArray(result, "lineup"),
    headliners: requiredArray(result, "headliners"),
    publishedSchedule: requiredArray(result, "publishedSchedule"),
    attendance: requiredNumber(result, "attendance"),
    audienceScore: requiredNumber(result, "audienceScore"),
    profitabilityBand: requiredString(result, "profitabilityBand"),
    completedAt: requiredString(result, "completedAt"),
    currencyCode: requiredString(result, "currencyCode"),
    financials: {
      ticketRevenueMinor: requiredNumber(financials, "ticketRevenueMinor"),
      sponsorshipRevenueMinor: requiredNumber(financials, "sponsorshipRevenueMinor"),
      foodAndDrinkRevenueMinor: requiredNumber(financials, "foodAndDrinkRevenueMinor"),
      merchandiseRevenueMinor: requiredNumber(financials, "merchandiseRevenueMinor"),
      operatingCostMinor: requiredNumber(financials, "operatingCostMinor"),
      taxMinor: requiredNumber(financials, "taxMinor"),
      totalRevenueMinor: requiredNumber(financials, "totalRevenueMinor"),
      netProfitMinor: requiredNumber(financials, "netProfitMinor"),
      ledgerFrozenAt: nullableString(financials.ledgerFrozenAt),
      ledgerReconciled: Boolean(financials.ledgerReconciled),
    },
    companyImpact: {
      settlementApplied: Boolean(companyImpact.settlementApplied),
      settlementAppliedAt: nullableString(companyImpact.settlementAppliedAt),
      companyTransactionId: nullableString(companyImpact.companyTransactionId),
      balanceBeforeMinor: nullableNumber(companyImpact.balanceBeforeMinor),
      balanceAfterMinor: nullableNumber(companyImpact.balanceAfterMinor),
      reputationBefore: nullableNumber(companyImpact.reputationBefore),
      reputationAfter: nullableNumber(companyImpact.reputationAfter),
      baseReputationChange: requiredNumber(companyImpact, "baseReputationChange"),
      engagementReputationBonus: requiredNumber(companyImpact, "engagementReputationBonus"),
      reputationChange: requiredNumber(companyImpact, "reputationChange"),
      engagementFinalised: Boolean(companyImpact.engagementFinalised),
      engagementFinalisedAt: nullableString(companyImpact.engagementFinalisedAt),
      realAttendance: parseRealAttendance(companyImpact.realAttendance),
    },
  };
}
