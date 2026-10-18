import { describe, expect, it } from "vitest";
import { canBuyListing, isListingAvailable, isValidListingPrice, marketFeeMinor, sellerPayoutMinor } from "./rules";

describe("skin market rules", () => {
  it("allows prices from £0.99 to £49.99 only", () => {
    expect(isValidListingPrice(98)).toBe(false);
    expect(isValidListingPrice(99)).toBe(true);
    expect(isValidListingPrice(4999)).toBe(true);
    expect(isValidListingPrice(5000)).toBe(false);
  });

  it("takes a 15% fee and pays the seller the rest", () => {
    expect(marketFeeMinor(1000)).toBe(150);
    expect(sellerPayoutMinor(1000)).toBe(850);
    expect(marketFeeMinor(199)).toBe(30);
    expect(sellerPayoutMinor(199)).toBe(169);
  });

  it("blocks buying your own listing", () => {
    expect(canBuyListing({ seller_user_id: "a" }, "a")).toBe(false);
    expect(canBuyListing({ seller_user_id: "a" }, "b")).toBe(true);
  });

  it("returns a reserved listing to sale after the hold expires", () => {
    const now = new Date("2026-10-17T12:00:00Z");
    expect(isListingAvailable({ status: "reserved", reserved_until: "2026-10-17T12:10:00Z" }, now)).toBe(false);
    expect(isListingAvailable({ status: "reserved", reserved_until: "2026-10-17T11:59:00Z" }, now)).toBe(true);
    expect(isListingAvailable({ status: "sold", reserved_until: null }, now)).toBe(false);
  });
});
