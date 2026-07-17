export type CityScale = "town" | "small_city" | "regional_city" | "major_city" | "global_city";
export type CityTrend = "strong_growth" | "growth" | "stable" | "slowing" | "decline" | "severe_decline";
export type CostCategory = "cost_of_living" | "commercial_rent" | "residential_rent" | "wage" | "utilities" | "fuel" | "accommodation" | "transport";

export interface CityEconomicProfile {
  cityId: string;
  countryCode: string;
  primaryCurrencyCode: string;
  population: number;
  cityScale: CityScale;
  prosperityIndex: number;
  costOfLivingIndex: number;
  commercialRentIndex: number;
  residentialRentIndex: number;
  wageIndex: number;
  utilityCostIndex: number;
  fuelCostIndex: number;
  accommodationCostIndex: number;
  transportCostIndex: number;
  consumerSpendingIndex: number;
  tourismIndex: number;
  musicMarketSize: number;
  localAudienceDemand: number;
  businessConfidenceIndex: number;
  employmentIndex: number;
  infrastructureQualityIndex: number;
  economicTrend: CityTrend;
}

export interface TemporaryCityEffect {
  category: CostCategory | "demand";
  strengthBasisPoints: number;
  active: boolean;
}

export interface PriceQuote {
  baseAmountMinor: number;
  category: CostCategory;
  cityMultiplierBasisPoints: number;
  eventMultiplierBasisPoints: number;
  existingModifierBasisPoints: number;
  finalAmountMinor: number;
  explanation: string[];
}

const indexByCategory: Record<CostCategory, keyof CityEconomicProfile> = {
  cost_of_living: "costOfLivingIndex",
  commercial_rent: "commercialRentIndex",
  residential_rent: "residentialRentIndex",
  wage: "wageIndex",
  utilities: "utilityCostIndex",
  fuel: "fuelCostIndex",
  accommodation: "accommodationCostIndex",
  transport: "transportCostIndex",
};

export function clampInt(value: number, min: number, max: number): number {
  return Math.trunc(Math.min(max, Math.max(min, Number.isFinite(value) ? value : min)));
}

export function labelForIndex(index: number): string {
  if (index < 70) return "Very low";
  if (index < 85) return "Low";
  if (index < 95) return "Below average";
  if (index <= 105) return "Average";
  if (index <= 120) return "Above average";
  if (index <= 140) return "High";
  return "Very high";
}

export function validateCityEconomicProfile(profile: CityEconomicProfile): string[] {
  const errors: string[] = [];
  if (!/^[A-Z]{3}$/.test(profile.primaryCurrencyCode)) errors.push("primaryCurrencyCode must be an ISO-like 3-letter code");
  if (profile.population < 0) errors.push("population cannot be negative");
  for (const [key, value] of Object.entries(profile)) {
    if (key.endsWith("Index") || key === "musicMarketSize" || key === "localAudienceDemand") {
      if (typeof value !== "number" || value < 1 || value > 300) errors.push(`${key} must be between 1 and 300`);
    }
  }
  return errors;
}

export function quoteCityPrice(profile: CityEconomicProfile | null, baseAmountMinor: number, category: CostCategory, options: { effects?: TemporaryCityEffect[]; existingModifierBasisPoints?: number } = {}): PriceQuote {
  if (baseAmountMinor < 0) throw new Error("baseAmountMinor cannot be negative");
  const index = profile ? Number(profile[indexByCategory[category]]) : 100;
  const cityMultiplierBasisPoints = clampInt(index * 100, 5_000, 20_000);
  const effectBoost = (options.effects ?? []).filter((effect) => effect.active && effect.category === category).reduce((sum, effect) => sum + clampInt(effect.strengthBasisPoints, 0, 5_000), 0);
  const eventMultiplierBasisPoints = clampInt(10_000 + effectBoost, 7_500, 15_000);
  const existingModifierBasisPoints = clampInt(options.existingModifierBasisPoints ?? 10_000, 1_000, 30_000);
  const numerator = BigInt(Math.trunc(baseAmountMinor)) * BigInt(cityMultiplierBasisPoints) * BigInt(eventMultiplierBasisPoints) * BigInt(existingModifierBasisPoints);
  const finalAmountMinor = Number((numerator + 500_000_000_000n) / 1_000_000_000_000n);
  return {
    baseAmountMinor,
    category,
    cityMultiplierBasisPoints,
    eventMultiplierBasisPoints,
    existingModifierBasisPoints,
    finalAmountMinor: Math.max(0, finalAmountMinor),
    explanation: [`${category} index ${index} (${labelForIndex(index)})`, ...(effectBoost ? [`temporary event pressure +${effectBoost}bp`] : [])],
  };
}

export function calculateWageGuidance(profile: CityEconomicProfile | null, baseRoleWageMinor: number) {
  const quote = quoteCityPrice(profile, baseRoleWageMinor, "wage");
  return {
    ...quote,
    recommendedWageMinor: quote.finalAmountMinor,
    minimumMarketMinor: Math.trunc((quote.finalAmountMinor * 85) / 100),
    maximumMarketMinor: Math.trunc((quote.finalAmountMinor * 120) / 100),
  };
}

export function calculateLocalAudienceDemand(profile: CityEconomicProfile | null, input: { genrePopularityIndex?: number; bandFame?: number; ticketPriceMinor?: number; venueCapacity: number; competitionIndex?: number; effects?: TemporaryCityEffect[] }) {
  const p = profile ?? ({ consumerSpendingIndex: 100, tourismIndex: 100, musicMarketSize: 100, localAudienceDemand: 100 } as CityEconomicProfile);
  const genre = clampInt(input.genrePopularityIndex ?? 100, 1, 250);
  const demandBasisPoints = clampInt(p.localAudienceDemand * 35 + p.musicMarketSize * 25 + p.consumerSpendingIndex * 15 + p.tourismIndex * 10 + genre * 15, 3_000, 25_000);
  const eventBoost = (input.effects ?? []).filter((effect) => effect.active && effect.category === "demand").reduce((sum, effect) => sum + effect.strengthBasisPoints, 0);
  const eventBasisPoints = clampInt(10_000 + eventBoost, 7_500, 15_000);
  const priceBasisPoints = clampInt(11_000 - Math.trunc(Math.max(0, (input.ticketPriceMinor ?? 2_500) - 2_500) / 100), 6_000, 14_000);
  const fameBasisPoints = clampInt(5_000 + (input.bandFame ?? 50) * 100, 1_000, 20_000);
  const competitionBasisPoints = clampInt(20_000 - (input.competitionIndex ?? 100) * 75, 5_000, 15_000);
  const potential = Math.trunc((input.venueCapacity * demandBasisPoints * eventBasisPoints * priceBasisPoints * fameBasisPoints * competitionBasisPoints) / 10_000 ** 5);
  return {
    estimatedPotentialAudience: clampInt(potential, 0, input.venueCapacity),
    priceSensitivityBasisPoints: priceBasisPoints,
    demandMultiplierBasisPoints: demandBasisPoints,
    confidenceLow: clampInt(Math.trunc(potential * 0.85), 0, input.venueCapacity),
    confidenceHigh: clampInt(Math.trunc(potential * 1.15), 0, input.venueCapacity),
  };
}
