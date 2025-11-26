export type SponsorableType = "tour" | "festival" | "venue";
export type SponsorshipEntityType = SponsorableType | "character" | "band";
export type SponsorshipOfferStatus =
  | "draft"
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  | "withdrawn";
export type SponsorshipContractStatus =
  | "pending"
  | "active"
  | "completed"
  | "terminated"
  | "cancelled";
export type SponsorshipHistoryEvent =
  | "offer_created"
  | "offer_updated"
  | "offer_expired"
  | "offer_withdrawn"
  | "offer_accepted"
  | "contract_signed"
  | "status_changed"
  | "payout_recorded";

export interface SponsorshipOfferRecord {
  id: string;
  brandId: string;
  sponsorableType: SponsorshipEntityType;
  sponsorableId: string;
  status: SponsorshipOfferStatus;
  exclusivity?: boolean;
  expiresAt: string;
  createdAt?: string;
}

export interface SponsorshipContractRecord {
  id: string;
  brandId: string;
  sponsorableType: SponsorshipEntityType;
  sponsorableId: string;
  status: SponsorshipContractStatus;
  isExclusive: boolean;
  offerId?: string | null;
}

export interface SponsorshipHistoryEntry {
  contractId: string;
  eventType: SponsorshipHistoryEvent;
  fromStatus?: SponsorshipContractStatus | null;
  toStatus?: SponsorshipContractStatus | null;
  notes?: string;
  createdAt?: string;
}
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
  const reachWeight = sponsorableType === "tour" ? 0.3 : sponsorableType === "festival" ? 0.25 : 0.2;
  const impactWeight = sponsorableType === "festival" ? 0.3 : 0.2;
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

const isActiveOrPending = (
  status: SponsorshipContractStatus
): boolean => status === "pending" || status === "active";

const isCharacter = (sponsorableType: SponsorshipEntityType): boolean =>
  sponsorableType === "character";

export const validateSponsorshipOfferGuardrails = (
  offer: SponsorshipOfferRecord,
  existingOffers: SponsorshipOfferRecord[],
  existingContracts: SponsorshipContractRecord[]
): { isValid: boolean; reasons: string[] } => {
  const reasons: string[] = [];

  const matchingContracts = existingContracts.filter(
    (contract) =>
      contract.sponsorableType === offer.sponsorableType &&
      contract.sponsorableId === offer.sponsorableId &&
      isActiveOrPending(contract.status)
  );

  const matchingPendingOffer = existingOffers.find(
    (existing) =>
      existing.brandId === offer.brandId &&
      existing.sponsorableId === offer.sponsorableId &&
      existing.sponsorableType === offer.sponsorableType &&
      existing.status === "pending"
  );

  if (matchingPendingOffer) {
    reasons.push("Duplicate pending offer exists for this brand and sponsorable");
  }

  const pendingOffersForSponsorable = existingOffers.filter(
    (existing) =>
      existing.sponsorableId === offer.sponsorableId &&
      existing.sponsorableType === offer.sponsorableType &&
      existing.status === "pending"
  );

  const pendingExclusiveBlocker = pendingOffersForSponsorable.find(
    (existing) => existing.exclusivity && existing.brandId !== offer.brandId
  );

  if (pendingExclusiveBlocker) {
    reasons.push("Existing pending exclusive offer prevents issuing this offer");
  }

  if (isCharacter(offer.sponsorableType) && matchingContracts.length >= 3) {
    reasons.push("Character has reached the maximum of three active sponsorship deals");
  }

  const hasExclusiveBlocker = matchingContracts.find(
    (contract) =>
      contract.isExclusive &&
      contract.brandId !== offer.brandId &&
      contract.status === "active"
  );

  if (hasExclusiveBlocker) {
    reasons.push("Existing exclusive contract prevents issuing this offer");
  }

  const hasBrandOverlap = matchingContracts.find(
    (contract) => contract.brandId === offer.brandId
  );

  if (hasBrandOverlap) {
    reasons.push("Brand already has an active or pending contract with this sponsorable");
  }

  if (offer.exclusivity) {
    const conflictingContract = matchingContracts.find(
      (contract) => contract.brandId !== offer.brandId
    );

    if (conflictingContract) {
      reasons.push("Exclusive offer conflicts with another active or pending contract");
    }

    const conflictingPendingOffer = pendingOffersForSponsorable.find(
      (existing) => existing.brandId !== offer.brandId
    );

    if (conflictingPendingOffer) {
      reasons.push("Exclusive offer conflicts with another pending offer");
    }
  }

  return { isValid: reasons.length === 0, reasons };
};

export const expireStaleSponsorshipOffers = (
  offers: SponsorshipOfferRecord[],
  contracts: SponsorshipContractRecord[],
  now: Date = new Date()
): {
  updatedOffers: SponsorshipOfferRecord[];
  updatedContracts: SponsorshipContractRecord[];
  historyEntries: SponsorshipHistoryEntry[];
  expiredOfferIds: string[];
  freedSlots: number;
} => {
  const nowTime = now.getTime();
  const expiredOfferIds = new Set<string>();

  const updatedOffers = offers.map((offer) => {
    if (offer.status === "pending" && new Date(offer.expiresAt).getTime() < nowTime) {
      expiredOfferIds.add(offer.id);
      return { ...offer, status: "expired" as const };
    }

    return offer;
  });

  const historyEntries: SponsorshipHistoryEntry[] = [];
  let freedSlots = 0;

  const updatedContracts = contracts.map((contract) => {
    if (
      contract.offerId &&
      expiredOfferIds.has(contract.offerId) &&
      contract.status === "pending"
    ) {
      freedSlots += 1;
      historyEntries.push({
        contractId: contract.id,
        eventType: "offer_expired",
        fromStatus: contract.status,
        toStatus: "cancelled",
        notes: "Offer expired before acceptance",
        createdAt: now.toISOString(),
      });

      return { ...contract, status: "cancelled" as const };
    }

    return contract;
  });

  return {
    updatedOffers,
    updatedContracts,
    historyEntries,
    expiredOfferIds: Array.from(expiredOfferIds),
    freedSlots,
  };
};
