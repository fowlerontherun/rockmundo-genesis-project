import { describe, expect, it } from "vitest";

import {
  acceptSponsorshipOffer,
  calculateSponsorshipPayout,
  createSponsorshipOffer,
  determineFameTier,
  expireStaleOffers,
  issueSponsorshipOfferWithGuardrails,
  type IssueSponsorshipOfferInput,
  type SponsorshipLifecycleState,
  type FameTier,
  type SponsorableType,
} from "../sponsorships";

const fixedRandom = (values: number[]) => {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
};

const baseInput = {
  brandWealth: 0.4,
  brandSize: 0.3,
  reach: 0.5,
  impact: 0.5,
  variance: 0.1,
};

const calculateWithFame = (
  fame: number,
  sponsorableType: SponsorableType,
  randomValues: number[] = [0.5, 0.5]
) => {
  return calculateSponsorshipPayout({
    fame,
    sponsorableType,
    ...baseInput,
    random: fixedRandom(randomValues),
  });
};

describe("sponsorship payouts", () => {
  it("scales payouts with fame tiers and respects tier transitions", () => {
    const local = calculateWithFame(500, "venue");
    const regional = calculateWithFame(1500, "venue");
    const national = calculateWithFame(4000, "venue");
    const global = calculateWithFame(8000, "venue");

    expect(local.breakdown.fameTier).toBe("local");
    expect(regional.breakdown.fameTier).toBe("regional");
    expect(national.breakdown.fameTier).toBe("national");
    expect(global.breakdown.fameTier).toBe("global");

    expect(regional.payout).toBeGreaterThan(local.payout);
    expect(national.payout).toBeGreaterThan(regional.payout);
    expect(global.payout).toBeGreaterThan(national.payout);
  });

  it("keeps randomized base payouts within tier ranges before multipliers", () => {
    const tightRandom = fixedRandom([0, 1]);

    const lowRoll = calculateSponsorshipPayout({
      fame: 500,
      sponsorableType: "tour",
      ...baseInput,
      random: tightRandom,
    });

    const highRoll = calculateSponsorshipPayout({
      fame: 500,
      sponsorableType: "tour",
      ...baseInput,
      random: fixedRandom([1, 0]),
    });

    expect(lowRoll.breakdown.baseWithinTier).toBeGreaterThanOrEqual(800);
    expect(highRoll.breakdown.baseWithinTier).toBeLessThanOrEqual(2000);
  });

  it("applies type-specific reach and impact multipliers", () => {
    const festivalMultiplier = calculateSponsorshipPayout({
      fame: 4000,
      sponsorableType: "festival",
      ...baseInput,
      reach: 0.8,
      impact: 0.9,
      random: fixedRandom([0.4, 0.4]),
    }).breakdown.reachImpactMultiplier;

    const tourMultiplier = calculateSponsorshipPayout({
      fame: 4000,
      sponsorableType: "tour",
      ...baseInput,
      reach: 0.8,
      impact: 0.9,
      random: fixedRandom([0.4, 0.4]),
    }).breakdown.reachImpactMultiplier;

    const venueMultiplier = calculateSponsorshipPayout({
      fame: 4000,
      sponsorableType: "venue",
      ...baseInput,
      reach: 0.8,
      impact: 0.9,
      random: fixedRandom([0.4, 0.4]),
    }).breakdown.reachImpactMultiplier;

    expect(festivalMultiplier).toBeGreaterThan(tourMultiplier);
    expect(tourMultiplier).toBeGreaterThan(venueMultiplier);
  });

  it("applies brand, reach/impact, and momentum bonuses to the payout", () => {
    const noMomentum = calculateSponsorshipPayout({
      fame: 3500,
      sponsorableType: "festival",
      ...baseInput,
      recentFameDelta: 0,
      random: fixedRandom([0.5, 0.5]),
    });

    const highMomentum = calculateSponsorshipPayout({
      fame: 3500,
      sponsorableType: "festival",
      ...baseInput,
      recentFameDelta: 2500,
      random: fixedRandom([0.5, 0.5]),
    });

    const premiumBrand = calculateSponsorshipPayout({
      fame: 3500,
      sponsorableType: "festival",
      brandWealth: 1,
      brandSize: 1,
      reach: 0.5,
      impact: 0.5,
      variance: 0.1,
      recentFameDelta: 0,
      random: fixedRandom([0.5, 0.5]),
    });

    expect(highMomentum.payout).toBeGreaterThan(noMomentum.payout);
    expect(premiumBrand.payout).toBeGreaterThan(noMomentum.payout);
  });

  it("only rewards positive momentum", () => {
    const neutral = calculateSponsorshipPayout({
      fame: 5200,
      sponsorableType: "tour",
      ...baseInput,
      recentFameDelta: -500,
      random: fixedRandom([0.5, 0.5]),
    });

    const positive = calculateSponsorshipPayout({
      fame: 5200,
      sponsorableType: "tour",
      ...baseInput,
      recentFameDelta: 1800,
      random: fixedRandom([0.5, 0.5]),
    });

    expect(positive.payout).toBeGreaterThan(neutral.payout);
  });

  it("persists payout on offers and propagates to contracts", () => {
    const offer = createSponsorshipOffer("offer-1", {
      fame: 6200,
      sponsorableType: "tour",
      ...baseInput,
      recentFameDelta: 800,
      random: fixedRandom([0.25, 0.75]),
    });

    expect(offer.payout).toBeGreaterThan(0);
    expect(offer.fameTier).toBe("national");

    const contract = acceptSponsorshipOffer(offer, "contract-1");
    expect(contract.payout).toBe(offer.payout);
    expect(contract.fameTier).toBe(offer.fameTier);
    expect(contract.offerId).toBe("offer-1");
  });

  it("exposes tier boundaries for external callers", () => {
    const tiers: Array<[number, FameTier]> = [
      [0, "local"],
      [1200, "regional"],
      [4200, "national"],
      [8000, "global"],
    ];

    tiers.forEach(([fame, expectedTier]) => {
      expect(determineFameTier(fame)).toBe(expectedTier);
    });
  });
});

describe("sponsorship guardrails", () => {
  const guardrailBaseInput: Omit<IssueSponsorshipOfferInput, "sponsorableId"> = {
    fame: 2200,
    sponsorableType: "tour",
    brandWealth: 0.5,
    brandSize: 0.5,
    reach: 0.4,
    impact: 0.4,
    category: "Beverage",
    brandId: "brand-1",
    brandName: "Fizz Co",
    exclusive: false,
    deadline: "2024-01-01T00:00:00.000Z",
    random: () => 0.5,
  };

  const baseState: SponsorshipLifecycleState = {
    offers: [],
    contracts: [],
    history: [],
  };

  it("blocks issuing offers when the character cap is exceeded", () => {
    const activeCharacterContracts = [
      "c1",
      "c2",
      "c3",
    ].map((contractId) => ({
      contractId,
      offerId: contractId.replace("c", "o"),
      sponsorableId: "character-1",
      sponsorableType: "character" as const,
      payout: 1000,
      fameTier: "local" as const,
      signedAt: "2024-01-01T00:00:00.000Z",
      status: "active" as const,
    }));

    const result = issueSponsorshipOfferWithGuardrails(
      "offer-blocked",
      { ...guardrailBaseInput, sponsorableType: "character", sponsorableId: "character-1" },
      { ...baseState, contracts: activeCharacterContracts }
    );

    expect(result.issuedOffer).toBeUndefined();
    expect(result.blockedReason).toBe("character_cap");
    expect(result.updatedState.history.at(-1)?.event).toBe("offer_cap_blocked");
  });

  it("rejects duplicate pending offers for the same sponsorable and brand", () => {
    const pendingOfferState: SponsorshipLifecycleState = {
      ...baseState,
      offers: [
        {
          sponsorableId: "tour-1",
          sponsorableType: "tour",
          brandId: "brand-1",
          brandName: "Fizz Co",
          category: "Beverage",
          exclusive: false,
          deadline: "2099-01-01T00:00:00.000Z",
          status: "pending",
          id: "offer-1",
          fame: 2200,
          brandWealth: 0.5,
          brandSize: 0.5,
          reach: 0.4,
          impact: 0.4,
          payout: 2000,
          fameTier: "regional",
          breakdown: {
            baseWithinTier: 2000,
            brandMultiplier: 1.1,
            reachImpactMultiplier: 1.1,
            momentumMultiplier: 1,
          },
        },
      ],
    };

    const result = issueSponsorshipOfferWithGuardrails(
      "offer-dup",
      { ...guardrailBaseInput, sponsorableId: "tour-1" },
      pendingOfferState
    );

    expect(result.issuedOffer).toBeUndefined();
    expect(result.blockedReason).toBe("duplicate_offer");
    expect(result.updatedState.history.at(-1)?.event).toBe("offer_duplicate_blocked");
  });

  it("prevents exclusivity conflicts against active contracts", () => {
    const activeExclusiveContract: SponsorshipLifecycleState = {
      ...baseState,
      contracts: [
        {
          contractId: "contract-1",
          offerId: "offer-1",
          sponsorableId: "festival-1",
          sponsorableType: "festival",
          status: "active",
          category: "Technology",
          exclusive: true,
          payout: 5000,
          fameTier: "regional",
          signedAt: "2024-01-01T00:00:00.000Z",
        },
      ],
    };

    const result = issueSponsorshipOfferWithGuardrails(
      "offer-exclusive",
      {
        ...guardrailBaseInput,
        sponsorableType: "festival",
        sponsorableId: "festival-1",
        exclusive: true,
        category: "Technology",
      },
      activeExclusiveContract
    );

    expect(result.issuedOffer).toBeUndefined();
    expect(result.blockedReason).toBe("exclusivity_conflict");
    expect(result.updatedState.history.at(-1)?.event).toBe("offer_exclusivity_blocked");
  });

  it("expires stale offers and records history", () => {
    const lifecycleState: SponsorshipLifecycleState = {
      ...baseState,
      offers: [
        {
          sponsorableId: "venue-1",
          sponsorableType: "venue",
          brandId: "brand-2",
          brandName: "Giga Telecom",
          category: "Telecom",
          exclusive: false,
          deadline: "2024-01-01T00:00:00.000Z",
          status: "pending",
          id: "offer-old",
          fame: 1200,
          brandWealth: 0.4,
          brandSize: 0.4,
          reach: 0.3,
          impact: 0.3,
          payout: 1200,
          fameTier: "regional",
          breakdown: {
            baseWithinTier: 900,
            brandMultiplier: 1.1,
            reachImpactMultiplier: 1.06,
            momentumMultiplier: 1,
          },
        },
        {
          sponsorableId: "venue-1",
          sponsorableType: "venue",
          brandId: "brand-3",
          brandName: "SnackCo",
          category: "Food",
          exclusive: false,
          deadline: "2099-01-01T00:00:00.000Z",
          status: "pending",
          id: "offer-future",
          fame: 1200,
          brandWealth: 0.4,
          brandSize: 0.4,
          reach: 0.3,
          impact: 0.3,
          payout: 1200,
          fameTier: "regional",
          breakdown: {
            baseWithinTier: 900,
            brandMultiplier: 1.1,
            reachImpactMultiplier: 1.06,
            momentumMultiplier: 1,
          },
        },
      ],
    };

    const now = new Date("2024-02-01T00:00:00.000Z");
    const expiredState = expireStaleOffers(lifecycleState, now);

    const expiredOffer = expiredState.offers.find((offer) => offer.id === "offer-old");
    const pendingOffer = expiredState.offers.find((offer) => offer.id === "offer-future");

    expect(expiredOffer?.status).toBe("expired");
    expect(pendingOffer?.status).toBe("pending");
    expect(expiredState.history.some((entry) => entry.event === "offer_expired")).toBe(true);
  });

  it("issues new offers across sponsorable types when guardrails pass", () => {
    const sponsorableTypes: SponsorableType[] = ["tour", "festival", "venue", "band", "character"];

    sponsorableTypes.forEach((type, index) => {
      const result = issueSponsorshipOfferWithGuardrails(
        `offer-${type}`,
        {
          ...guardrailBaseInput,
          sponsorableType: type,
          sponsorableId: `${type}-${index}`,
          deadline: "2099-01-01T00:00:00.000Z",
        },
        baseState
      );

      expect(result.issuedOffer?.sponsorableType).toBe(type);
      expect(result.updatedState.history.at(-1)?.event).toBe("offer_issued");
    });
  });
});
