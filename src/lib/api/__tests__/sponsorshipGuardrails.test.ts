import { describe, expect, it } from "vitest";

import {
  expireStaleSponsorshipOffers,
  type SponsorshipContractRecord,
  type SponsorshipOfferRecord,
  validateSponsorshipOfferGuardrails,
} from "../sponsorships";

describe("sponsorship guardrails", () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 3);

  const baseOffer: SponsorshipOfferRecord = {
    id: "offer-new",
    brandId: "brand-new",
    sponsorableId: "tour-1",
    sponsorableType: "tour",
    status: "pending",
    exclusivity: false,
    expiresAt: futureDate.toISOString(),
  };

  it("blocks duplicate pending offers and brand overlaps", () => {
    const existingOffers: SponsorshipOfferRecord[] = [
      { ...baseOffer, id: "offer-existing" },
    ];

    const result = validateSponsorshipOfferGuardrails(baseOffer, existingOffers, []);

    expect(result.isValid).toBe(false);
    expect(result.reasons).toContain(
      "Duplicate pending offer exists for this brand and sponsorable"
    );
  });

  it("enforces character caps and exclusivity conflicts", () => {
    const characterOffer: SponsorshipOfferRecord = {
      ...baseOffer,
      sponsorableType: "character",
      sponsorableId: "character-1",
      brandId: "brand-d",
      exclusivity: true,
    };

    const contracts: SponsorshipContractRecord[] = [
      {
        id: "c1",
        brandId: "brand-a",
        sponsorableType: "character",
        sponsorableId: "character-1",
        status: "active",
        isExclusive: false,
        offerId: "o1",
      },
      {
        id: "c2",
        brandId: "brand-b",
        sponsorableType: "character",
        sponsorableId: "character-1",
        status: "pending",
        isExclusive: false,
        offerId: "o2",
      },
      {
        id: "c3",
        brandId: "brand-c",
        sponsorableType: "character",
        sponsorableId: "character-1",
        status: "active",
        isExclusive: true,
        offerId: "o3",
      },
    ];

    const result = validateSponsorshipOfferGuardrails(characterOffer, [], contracts);

    expect(result.isValid).toBe(false);
    expect(result.reasons).toContain(
      "Character has reached the maximum of three active sponsorship deals"
    );
    expect(result.reasons).toContain(
      "Existing exclusive contract prevents issuing this offer"
    );
    expect(result.reasons).toContain(
      "Exclusive offer conflicts with another active or pending contract"
    );
  });

  it("blocks exclusivity conflicts but allows clean slots across sponsorable types", () => {
    const exclusiveOffer: SponsorshipOfferRecord = {
      ...baseOffer,
      sponsorableType: "venue",
      sponsorableId: "venue-22",
      exclusivity: true,
    };

    const contracts: SponsorshipContractRecord[] = [
      {
        id: "venue-contract",
        brandId: "another-brand",
        sponsorableType: "venue",
        sponsorableId: "venue-22",
        status: "active",
        isExclusive: false,
        offerId: "venue-offer",
      },
    ];

    const exclusiveResult = validateSponsorshipOfferGuardrails(
      exclusiveOffer,
      [],
      contracts
    );

    expect(exclusiveResult.isValid).toBe(false);
    expect(exclusiveResult.reasons).toContain(
      "Exclusive offer conflicts with another active or pending contract"
    );

    const festivalOffer: SponsorshipOfferRecord = {
      ...baseOffer,
      id: "festival-offer",
      brandId: "festival-brand",
      sponsorableType: "festival",
      sponsorableId: "festival-9",
      exclusivity: false,
    };

    const festivalResult = validateSponsorshipOfferGuardrails(
      festivalOffer,
      [],
      contracts
    );

    expect(festivalResult.isValid).toBe(true);
    expect(festivalResult.reasons).toHaveLength(0);
  });

  it("expires stale offers, frees slots, and records history", () => {
    const now = new Date("2025-01-10T12:00:00Z");
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const offers: SponsorshipOfferRecord[] = [
      {
        ...baseOffer,
        id: "expired-offer",
        expiresAt: yesterday,
      },
      {
        ...baseOffer,
        id: "fresh-offer",
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      },
      { ...baseOffer, id: "accepted-offer", status: "accepted" },
    ];

    const contracts: SponsorshipContractRecord[] = [
      {
        id: "pending-contract",
        brandId: "brand-new",
        sponsorableType: "tour",
        sponsorableId: "tour-1",
        status: "pending",
        isExclusive: false,
        offerId: "expired-offer",
      },
      {
        id: "active-contract",
        brandId: "brand-new",
        sponsorableType: "tour",
        sponsorableId: "tour-1",
        status: "active",
        isExclusive: false,
        offerId: "fresh-offer",
      },
    ];

    const result = expireStaleSponsorshipOffers(offers, contracts, now);

    expect(result.expiredOfferIds).toEqual(["expired-offer"]);
    expect(result.freedSlots).toBe(1);
    expect(result.historyEntries).toHaveLength(1);
    expect(result.historyEntries[0]).toMatchObject({
      contractId: "pending-contract",
      fromStatus: "pending",
      toStatus: "cancelled",
      eventType: "offer_expired",
    });

    const expiredOffer = result.updatedOffers.find(
      (offer) => offer.id === "expired-offer"
    );
    expect(expiredOffer?.status).toBe("expired");

    const cancelledContract = result.updatedContracts.find(
      (contract) => contract.id === "pending-contract"
    );
    expect(cancelledContract?.status).toBe("cancelled");

    const untouchedContract = result.updatedContracts.find(
      (contract) => contract.id === "active-contract"
    );
    expect(untouchedContract?.status).toBe("active");
  });
});
