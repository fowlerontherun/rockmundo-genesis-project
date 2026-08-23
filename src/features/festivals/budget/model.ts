export interface FestivalBudgetForecast {
  festivalCompanyId: string;
  festivalEditionId: string;
  currencyCode: string;
  expectedTicketsSold: number;
  expectedAttendance: number;
  ticketRevenueMinor: number;
  sponsorshipRevenueMinor: number;
  foodAndDrinkRevenueMinor: number;
  merchandiseRevenueMinor: number;
  totalRevenueMinor: number;
  operatingCostMinor: number;
  projectedNetProfitMinor: number;
  projectionSource: "simplified_budget_v1";
  sponsorshipMode: "automatic";
}

const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const requiredString = (value: Record<string, unknown>, key: string) => {
  if (typeof value[key] !== "string") {
    throw new Error(`Invalid Festival budget field: ${key}`);
  }
  return value[key] as string;
};

const requiredNumber = (value: Record<string, unknown>, key: string) => {
  const candidate = value[key];
  if (typeof candidate !== "number" || !Number.isSafeInteger(candidate)) {
    throw new Error(`Invalid Festival budget field: ${key}`);
  }
  return candidate;
};

export function parseFestivalBudgetForecast(value: unknown): FestivalBudgetForecast {
  if (!object(value)) throw new Error("Invalid Festival budget forecast response");

  const projectionSource = requiredString(value, "projectionSource");
  const sponsorshipMode = requiredString(value, "sponsorshipMode");
  if (projectionSource !== "simplified_budget_v1" || sponsorshipMode !== "automatic") {
    throw new Error("Unsupported Festival budget forecast response");
  }

  return {
    festivalCompanyId: requiredString(value, "festivalCompanyId"),
    festivalEditionId: requiredString(value, "festivalEditionId"),
    currencyCode: requiredString(value, "currencyCode"),
    expectedTicketsSold: requiredNumber(value, "expectedTicketsSold"),
    expectedAttendance: requiredNumber(value, "expectedAttendance"),
    ticketRevenueMinor: requiredNumber(value, "ticketRevenueMinor"),
    sponsorshipRevenueMinor: requiredNumber(value, "sponsorshipRevenueMinor"),
    foodAndDrinkRevenueMinor: requiredNumber(value, "foodAndDrinkRevenueMinor"),
    merchandiseRevenueMinor: requiredNumber(value, "merchandiseRevenueMinor"),
    totalRevenueMinor: requiredNumber(value, "totalRevenueMinor"),
    operatingCostMinor: requiredNumber(value, "operatingCostMinor"),
    projectedNetProfitMinor: requiredNumber(value, "projectedNetProfitMinor"),
    projectionSource: "simplified_budget_v1",
    sponsorshipMode: "automatic",
  };
}
