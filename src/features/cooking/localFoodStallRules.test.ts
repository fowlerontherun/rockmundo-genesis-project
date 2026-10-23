import { describe, expect, it } from "vitest";
import { previewLocalFoodPurchase, validLocalStallExpiry, type StallPurchasePreview } from "./localFoodStallRules";

const preview: StallPurchasePreview = {
  listing: { id: "listing-1", sellerProfileId: "seller", cityId: "city-1", batchId: "batch-1",
    portionsAvailable: 3, pricePerPortion: 125, expiresAt: "2026-10-24T00:00:00Z", status: "open" },
  batch: { id: "batch-1", profileId: "seller", recipeSlug: "apple-pie", portions: 4, quality: 80,
    preparedAt: "2026-10-22T00:00:00Z", expiresAt: "2026-10-25T00:00:00Z" },
  buyerProfileId: "buyer", buyerCityId: "city-1", quantity: 2,
  availableCash: 500, nowMs: Date.parse("2026-10-23T00:00:00Z"), feeBasisPoints: 500,
};
const result = (changes: Partial<StallPurchasePreview>) => previewLocalFoodPurchase({ ...preview, ...changes });

describe("local food stall preview (not transactional authorization)", () => {
  it("quotes buyer price and bounded seller-paid city fee without float currency", () => {
    expect(result({})).toEqual({ eligible: true, subtotal: 250, fee: 12, total: 250 });
  });
  it("blocks cross-city and self-purchases", () => {
    expect(result({ buyerCityId: "elsewhere" })).toMatchObject({ reason: "wrong_city" });
    expect(result({ buyerProfileId: "seller" })).toMatchObject({ reason: "self_trade" });
  });
  it("rejects sold listings and mismatched maker, batch or city identity", () => {
    expect(result({ listing: { ...preview.listing, status: "sold" } })).toMatchObject({ reason: "invalid_listing" });
    expect(result({ listing: { ...preview.listing, batchId: "other" } })).toMatchObject({ reason: "invalid_listing" });
    expect(result({ batch: { ...preview.batch, profileId: "other" } })).toMatchObject({ reason: "invalid_listing" });
  });
  it("rejects expiry at the exact boundary and never extends the food's expiry", () => {
    expect(result({ nowMs: Date.parse(preview.listing.expiresAt) })).toMatchObject({ reason: "expired_listing" });
    expect(result({ nowMs: Date.parse(preview.batch.expiresAt) })).toMatchObject({ reason: "expired_food" });
    expect(validLocalStallExpiry(preview.batch, "2026-10-26T00:00:00Z", preview.nowMs)).toBe(false);
    expect(validLocalStallExpiry(preview.batch, "2026-10-24T00:00:00Z", preview.nowMs)).toBe(true);
  });
  it("rejects fractional/excess quantity, invalid fees, overflowing costs and insufficient cash", () => {
    expect(result({ quantity: 4 })).toMatchObject({ reason: "insufficient_stock" });
    expect(result({ quantity: 1.5 })).toMatchObject({ reason: "invalid_listing" });
    expect(result({ feeBasisPoints: 1500 })).toMatchObject({ reason: "invalid_listing" });
    expect(result({ availableCash: 249 })).toMatchObject({ reason: "insufficient_funds" });
    expect(result({ listing: { ...preview.listing, pricePerPortion: Number.MAX_SAFE_INTEGER } })).toMatchObject({ reason: "invalid_listing" });
  });
});
