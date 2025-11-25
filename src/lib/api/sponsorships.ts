export type SponsorableType = "tour" | "festival" | "venue";
export type FameTier = "local" | "regional" | "national" | "global";

interface PayoutRange {
  min: number;
  max: number;
}

const FAME_TIER_THRESHOLDS: Array<{ tier: FameTier; minFame: number }> = [
  { tier: "local", minFame: 0 },
  { tier: "regional", minFame: 1000 },
  { tier: "national", minFame: 3500 },
  { tier: "global", minFame: 7000 },
];

const BASE_PAYOUT_RANGES: Record<SponsorableType, Record<FameTier, PayoutRange>> = {
  tour: {
    local: { min: 800, max: 2000 },
    regional: { min: 2500, max: 6000 },
    national: { min: 6000, max: 12000 },
    global: { min: 12000, max: 25000 },
  },
  festival: {
    local: { min: 1500, max: 3500 },
    regional: { min: 4000, max: 9000 },
    national: { min: 9000, max: 18000 },
    global: { min: 18000, max: 32000 },
  },
  venue: {
    local: { min: 400, max: 900 },
    regional: { min: 900, max: 2200 },
    national: { min: 2200, max: 4500 },
    global: { min: 4500, max: 9000 },
  },
};

const REACH_IMPACT_WEIGHTS: Record<
  SponsorableType,
  { reachWeight: number; impactWeight: number }
> = {
  tour: { reachWeight: 0.3, impactWeight: 0.2 },
  festival: { reachWeight: 0.25, impactWeight: 0.3 },
  venue: { reachWeight: 0.2, impactWeight: 0.2 },
};

export interface PayoutCalculationInput {
  fame: number;
  sponsorableType: SponsorableType;
  brandWealth: number; // 0-1 scale where higher means deeper pockets
  brandSize: number; // 0-1 scale representing brand footprint
  reach: number; // 0-1 scale for how far the activation travels
  impact: number; // 0-1 scale for cultural/press impact
  recentFameDelta?: number;
  variance?: number;
  random?: () => number;
}

export interface PayoutCalculationBreakdown {
  fameTier: FameTier;
  baseWithinTier: number;
  brandMultiplier: number;
  reachImpactMultiplier: number;
  momentumMultiplier: number;
}

export interface PayoutCalculationResult {
  payout: number;
  breakdown: PayoutCalculationBreakdown;
}

export interface SponsorshipOffer {
  id: string;
  sponsorableType: SponsorableType;
  fame: number;
  brandWealth: number;
  brandSize: number;
  reach: number;
  impact: number;
  recentFameDelta?: number;
  payout: number;
  fameTier: FameTier;
  breakdown: Omit<PayoutCalculationBreakdown, "fameTier">;
}

export interface SponsorshipContract {
  contractId: string;
  offerId: string;
  sponsorableType: SponsorableType;
  payout: number;
  fameTier: FameTier;
  signedAt: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const determineFameTier = (fame: number): FameTier => {
  const sorted = [...FAME_TIER_THRESHOLDS].sort((a, b) => b.minFame - a.minFame);
  const match = sorted.find((threshold) => fame >= threshold.minFame);
  return match?.tier ?? "local";
};

const getBaseRange = (type: SponsorableType, tier: FameTier): PayoutRange => {
  return BASE_PAYOUT_RANGES[type][tier];
};

const calculateVarianceAdjustedBase = (
  range: PayoutRange,
  variance: number,
  random: () => number
): number => {
  const span = range.max - range.min;
  const randomWithinRange = range.min + span * random();
  const varianceShift = (random() * 2 - 1) * variance;
  const adjusted = randomWithinRange * (1 + varianceShift);
  return clamp(adjusted, range.min, range.max);
};

const calculateBrandMultiplier = (brandWealth: number, brandSize: number) => {
  const wealthInfluence = clamp(brandWealth, 0, 1) * 0.15;
  const sizeInfluence = clamp(brandSize, 0, 1) * 0.1;
  return 1 + wealthInfluence + sizeInfluence;
};

const calculateReachImpactMultiplier = (reach: number, impact: number, sponsorableType: SponsorableType) => {
  const { reachWeight, impactWeight } = REACH_IMPACT_WEIGHTS[sponsorableType];
  const reachContribution = clamp(reach, 0, 1) * reachWeight;
  const impactContribution = clamp(impact, 0, 1) * impactWeight;
  return 1 + reachContribution + impactContribution;
};

const calculateMomentumMultiplier = (recentFameDelta: number | undefined) => {
  const positiveDelta = Math.max(0, recentFameDelta ?? 0);
  const bonus = clamp(positiveDelta / 5000, 0, 0.2);
  return 1 + bonus;
};

export const calculateSponsorshipPayout = (
  input: PayoutCalculationInput
): PayoutCalculationResult => {
  const random = input.random ?? Math.random;
  const variance = clamp(input.variance ?? 0.12, 0, 0.5);

  const fameTier = determineFameTier(input.fame);
  const baseRange = getBaseRange(input.sponsorableType, fameTier);
  const baseWithinTier = calculateVarianceAdjustedBase(baseRange, variance, random);

  const brandMultiplier = calculateBrandMultiplier(input.brandWealth, input.brandSize);
  const reachImpactMultiplier = calculateReachImpactMultiplier(
    input.reach,
    input.impact,
    input.sponsorableType
  );
  const momentumMultiplier = calculateMomentumMultiplier(input.recentFameDelta);

  const payout = Math.round(
    baseWithinTier * brandMultiplier * reachImpactMultiplier * momentumMultiplier
  );

  return {
    payout,
    breakdown: {
      fameTier,
      baseWithinTier,
      brandMultiplier,
      reachImpactMultiplier,
      momentumMultiplier,
    },
  };
};

export const createSponsorshipOffer = (
  id: string,
  input: Omit<PayoutCalculationInput, "random"> & { random?: () => number }
): SponsorshipOffer => {
  const { payout, breakdown } = calculateSponsorshipPayout(input);

  return {
    id,
    sponsorableType: input.sponsorableType,
    fame: input.fame,
    brandWealth: input.brandWealth,
    brandSize: input.brandSize,
    reach: input.reach,
    impact: input.impact,
    recentFameDelta: input.recentFameDelta,
    payout,
    fameTier: breakdown.fameTier,
    breakdown: {
      baseWithinTier: breakdown.baseWithinTier,
      brandMultiplier: breakdown.brandMultiplier,
      reachImpactMultiplier: breakdown.reachImpactMultiplier,
      momentumMultiplier: breakdown.momentumMultiplier,
    },
  };
};

export const acceptSponsorshipOffer = (
  offer: SponsorshipOffer,
  contractId: string
): SponsorshipContract => {
  return {
    contractId,
    offerId: offer.id,
    sponsorableType: offer.sponsorableType,
    payout: offer.payout,
    fameTier: offer.fameTier,
    signedAt: new Date().toISOString(),
  };
};
