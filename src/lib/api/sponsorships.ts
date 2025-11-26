export type SponsorableType = "tour" | "festival" | "venue" | "band" | "character";
export type FameTier = "local" | "regional" | "national" | "global";

export type SponsorshipOfferStatus = "pending" | "accepted" | "expired" | "declined";
export type SponsorshipContractStatus =
  | "pending"
  | "active"
  | "completed"
  | "terminated"
  | "cancelled";

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
  band: {
    local: { min: 1000, max: 2500 },
    regional: { min: 2800, max: 6500 },
    national: { min: 6500, max: 14000 },
    global: { min: 14000, max: 26000 },
  },
  character: {
    local: { min: 600, max: 1400 },
    regional: { min: 1400, max: 3200 },
    national: { min: 3200, max: 7500 },
    global: { min: 7500, max: 14000 },
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
  status?: SponsorshipContractStatus;
  sponsorableId?: string;
  category?: string;
  exclusive?: boolean;
}

export interface ManagedSponsorshipOffer extends SponsorshipOffer {
  sponsorableId: string;
  brandId: string;
  brandName: string;
  category: string;
  exclusive: boolean;
  deadline: string;
  status: SponsorshipOfferStatus;
}

export interface ManagedSponsorshipContract extends SponsorshipContract {
  sponsorableId: string;
  brandId?: string;
  brandName?: string;
  category?: string;
  exclusive?: boolean;
  status: SponsorshipContractStatus;
}

export type SponsorshipHistoryEvent =
  | "offer_issued"
  | "offer_cap_blocked"
  | "offer_duplicate_blocked"
  | "offer_exclusivity_blocked"
  | "offer_expired";

export interface SponsorshipHistoryEntry {
  id: string;
  sponsorableId: string;
  sponsorableType: SponsorableType;
  offerId?: string;
  contractId?: string;
  event: SponsorshipHistoryEvent;
  occurredAt: string;
  details: string;
}

export interface SponsorshipLifecycleState {
  offers: ManagedSponsorshipOffer[];
  contracts: ManagedSponsorshipContract[];
  history: SponsorshipHistoryEntry[];
}

export interface IssueSponsorshipOfferInput
  extends Omit<PayoutCalculationInput, "random"> {
  sponsorableId: string;
  brandId: string;
  brandName: string;
  category: string;
  exclusive?: boolean;
  deadline: string;
  random?: () => number;
}

export interface IssueSponsorshipOfferResult {
  issuedOffer?: ManagedSponsorshipOffer;
  updatedState: SponsorshipLifecycleState;
  blockedReason?: string;
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
  const reachWeight =
    sponsorableType === "tour" || sponsorableType === "band"
      ? 0.3
      : sponsorableType === "festival"
        ? 0.25
        : 0.2;
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
    status: "active",
  };
};

const createHistoryEntry = (
  sponsorableId: string,
  sponsorableType: SponsorableType,
  event: SponsorshipHistoryEvent,
  details: string,
  offerId?: string,
  contractId?: string
): SponsorshipHistoryEntry => {
  return {
    id: `${event}-${offerId ?? contractId ?? Date.now()}`,
    sponsorableId,
    sponsorableType,
    event,
    occurredAt: new Date().toISOString(),
    details,
    offerId,
    contractId,
  };
};

const hasExclusiveConflict = (
  input: IssueSponsorshipOfferInput,
  contracts: ManagedSponsorshipContract[]
) => {
  return contracts.some(
    (contract) =>
      contract.sponsorableId === input.sponsorableId &&
      contract.sponsorableType === input.sponsorableType &&
      contract.status === "active" &&
      contract.category === input.category &&
      (contract.exclusive || input.exclusive)
  );
};

const hasDuplicatePendingOffer = (
  input: IssueSponsorshipOfferInput,
  offers: ManagedSponsorshipOffer[]
) => {
  return offers.some(
    (offer) =>
      offer.sponsorableId === input.sponsorableId &&
      offer.sponsorableType === input.sponsorableType &&
      offer.status === "pending" &&
      offer.brandId === input.brandId
  );
};

export const expireStaleOffers = (
  state: SponsorshipLifecycleState,
  now = new Date()
): SponsorshipLifecycleState => {
  const expiredEntries: SponsorshipHistoryEntry[] = [];

  const offers = state.offers.map((offer) => {
    if (offer.status !== "pending") return offer;

    const deadline = new Date(offer.deadline);
    if (deadline.getTime() < now.getTime()) {
      expiredEntries.push(
        createHistoryEntry(
          offer.sponsorableId,
          offer.sponsorableType,
          "offer_expired",
          `Offer ${offer.id} expired at ${offer.deadline}`,
          offer.id,
          undefined
        )
      );
      return { ...offer, status: "expired" as const };
    }
    return offer;
  });

  return {
    ...state,
    offers,
    history: [...state.history, ...expiredEntries],
  };
};

export const issueSponsorshipOfferWithGuardrails = (
  id: string,
  input: IssueSponsorshipOfferInput,
  state: SponsorshipLifecycleState
): IssueSponsorshipOfferResult => {
  const baseState = expireStaleOffers(state);
  const history = [...baseState.history];

  const activeCharacterDeals = baseState.contracts.filter(
    (contract) => contract.sponsorableType === "character" && contract.status === "active"
  ).length;

  if (input.sponsorableType === "character" && activeCharacterDeals >= 3) {
    const entry = createHistoryEntry(
      input.sponsorableId,
      input.sponsorableType,
      "offer_cap_blocked",
      "Character sponsorship cap reached"
    );
    return {
      blockedReason: "character_cap",
      updatedState: { ...baseState, history: [...history, entry] },
    };
  }

  if (hasDuplicatePendingOffer(input, baseState.offers)) {
    const entry = createHistoryEntry(
      input.sponsorableId,
      input.sponsorableType,
      "offer_duplicate_blocked",
      "Duplicate pending offer detected",
      id
    );
    return {
      blockedReason: "duplicate_offer",
      updatedState: { ...baseState, history: [...history, entry] },
    };
  }

  if (hasExclusiveConflict(input, baseState.contracts)) {
    const entry = createHistoryEntry(
      input.sponsorableId,
      input.sponsorableType,
      "offer_exclusivity_blocked",
      "Exclusive offer conflicts with active contract",
      id
    );
    return {
      blockedReason: "exclusivity_conflict",
      updatedState: { ...baseState, history: [...history, entry] },
    };
  }

  const offer = createSponsorshipOffer(id, input);
  const managedOffer: ManagedSponsorshipOffer = {
    ...offer,
    sponsorableId: input.sponsorableId,
    brandId: input.brandId,
    brandName: input.brandName,
    category: input.category,
    exclusive: input.exclusive ?? false,
    deadline: input.deadline,
    status: "pending",
  };

  const issuedHistory = createHistoryEntry(
    input.sponsorableId,
    input.sponsorableType,
    "offer_issued",
    `Issued offer ${id} for ${input.category}`,
    id
  );

  return {
    issuedOffer: managedOffer,
    updatedState: {
      ...baseState,
      offers: [...baseState.offers, managedOffer],
      history: [...history, issuedHistory],
    },
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
