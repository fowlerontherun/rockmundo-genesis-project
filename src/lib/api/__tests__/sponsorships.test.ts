import { describe, expect, it } from "vitest";

import {
  acceptSponsorshipOffer,
  calculateSponsorshipPayout,
  createSponsorshipOffer,
  determineFameTier,
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
