import { describe, expect, it } from "vitest";
import { normalizeGigReplayCommerceSnapshot } from "../commerce";

const snapshot = {
  formulaVersion: "gig-commerce-v1",
  settlementId: "settlement-1",
  merchandise: {
    itemsSold: 3,
    grossRevenue: 60,
    cost: 18,
    owner: "band",
    lines: [{ merchandiseId: "merch-1", variantId: null, itemType: "shirt", name: "Tour tee", quantity: 3, unitPrice: 20, gross: 60 }],
  },
  bar: {
    drinksServed: 10,
    grossRevenue: 60,
    venueRevenue: 45,
    bandEntitlement: 15,
    owner: "shared_by_confirmed_booking",
    shareSource: "confirmed_booking",
  },
} as const;

describe("gig replay commerce boundary", () => {
  it("returns a detached, validated settlement snapshot", () => {
    const normalized = normalizeGigReplayCommerceSnapshot(snapshot);
    expect(normalized).toEqual(snapshot);
    expect(normalized).not.toBe(snapshot);
    expect(normalized?.merchandise.lines).not.toBe(snapshot.merchandise.lines);
  });

  it.each([
    null,
    { ...snapshot, merchandise: { ...snapshot.merchandise, itemsSold: -1 } },
    { ...snapshot, merchandise: { ...snapshot.merchandise, grossRevenue: 59 } },
    { ...snapshot, merchandise: { ...snapshot.merchandise, lines: [{ ...snapshot.merchandise.lines[0], gross: 59 }] } },
    { ...snapshot, bar: { ...snapshot.bar, grossRevenue: Number.NaN } },
    { ...snapshot, bar: { ...snapshot.bar, venueRevenue: 60 } },
    { ...snapshot, bar: { ...snapshot.bar, owner: "band" } },
    { ...snapshot, bar: { ...snapshot.bar, owner: "venue" } },
    { ...snapshot, bar: { ...snapshot.bar, shareSource: "venue_fallback" } },
    { ...snapshot, bar: { ...snapshot.bar, bandEntitlement: 0, venueRevenue: 60 } },
  ])("rejects malformed authoritative facts without throwing", (candidate) => {
    expect(normalizeGigReplayCommerceSnapshot(candidate)).toBeNull();
  });
});
