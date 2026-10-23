import { foodAvailability, type FoodBatch } from "./foodBatchRules";

// Preview-only rules for the proposed player-operated city stalls.
// Authoritative listings, escrow, fees, cash debits and ownership transfers
// MUST be implemented together in trusted SQL transactions before launch.
export interface LocalFoodListing {
  id: string;
  sellerProfileId: string;
  cityId: string;
  batchId: string;
  portionsAvailable: number;
  pricePerPortion: number;
  expiresAt: string;
  status: "open" | "sold" | "cancelled";
}

export type StallEligibilityFailure =
  | "invalid_listing"
  | "wrong_city"
  | "self_trade"
  | "expired_food"
  | "expired_listing"
  | "insufficient_stock"
  | "insufficient_funds";

export type StallEligibility =
  | { eligible: true; subtotal: number; fee: number; total: number }
  | { eligible: false; reason: StallEligibilityFailure };

export interface StallPurchasePreview {
  listing: LocalFoodListing;
  batch: FoodBatch;
  buyerProfileId: string;
  buyerCityId: string;
  quantity: number;
  availableCash: number;
  nowMs: number;
  /** Fee is paid out of the seller's proceeds, never added to the buyer's quoted total. */
  feeBasisPoints: number;
}

/** Fail closed for invalid money, expiry, city and quantity inputs. */
export function previewLocalFoodPurchase(input: StallPurchasePreview): StallEligibility {
  const { listing, batch, buyerProfileId, buyerCityId, quantity, availableCash, nowMs, feeBasisPoints } = input;
  if (
    !listing.id || !listing.cityId || !listing.sellerProfileId || !listing.batchId ||
    listing.status !== "open" || listing.batchId !== batch.id ||
    listing.sellerProfileId !== batch.profileId ||
    !Number.isSafeInteger(listing.pricePerPortion) || listing.pricePerPortion <= 0 ||
    !Number.isSafeInteger(listing.portionsAvailable) || listing.portionsAvailable <= 0 ||
    !Number.isSafeInteger(quantity) || quantity <= 0 ||
    !Number.isSafeInteger(feeBasisPoints) || feeBasisPoints < 0 || feeBasisPoints > 1000 ||
    !Number.isSafeInteger(availableCash) || availableCash < 0 ||
    !Number.isFinite(nowMs) || !Number.isFinite(Date.parse(listing.expiresAt))
  ) return { eligible: false, reason: "invalid_listing" };
  if (buyerCityId !== listing.cityId) return { eligible: false, reason: "wrong_city" };
  if (!buyerProfileId || buyerProfileId === listing.sellerProfileId) {
    return { eligible: false, reason: "self_trade" };
  }
  if (foodAvailability(batch, nowMs) !== "fresh") return { eligible: false, reason: "expired_food" };
  if (nowMs >= Date.parse(listing.expiresAt)) return { eligible: false, reason: "expired_listing" };
  if (quantity > listing.portionsAvailable || quantity > batch.portions) {
    return { eligible: false, reason: "insufficient_stock" };
  }
  const subtotal = quantity * listing.pricePerPortion;
  if (!Number.isSafeInteger(subtotal)) return { eligible: false, reason: "invalid_listing" };
  if (subtotal > availableCash) return { eligible: false, reason: "insufficient_funds" };
  const fee = Math.floor(subtotal * feeBasisPoints / 10_000);
  return { eligible: true, subtotal, fee, total: subtotal };
}

/** A listing must never claim a later expiry than the underlying batch. */
export function validLocalStallExpiry(batch: FoodBatch, listingExpiresAt: string, nowMs: number): boolean {
  const expires = Date.parse(listingExpiresAt);
  const batchExpires = Date.parse(batch.expiresAt);
  return foodAvailability(batch, nowMs) === "fresh" &&
    Number.isFinite(expires) && expires > nowMs && expires <= batchExpires;
}
