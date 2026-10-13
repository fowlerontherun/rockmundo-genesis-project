import { describe, expect, it } from "vitest";
import {
  canOfferFestivalCheckIn,
  canStartFestivalTicketPurchase,
} from "../publicFestivalEligibility";

describe("festival UI eligibility", () => {
  it("never exposes a stale cached check-in action after either verification fails", () => {
    const eligible = { canCheckIn: true };
    expect(canOfferFestivalCheckIn(eligible, null, null)).toBe(true);
    expect(canOfferFestivalCheckIn(eligible, new Error("wallet unavailable"), null)).toBe(false);
    expect(canOfferFestivalCheckIn(eligible, null, new Error("eligibility unavailable"))).toBe(false);
    expect(canOfferFestivalCheckIn({ canCheckIn: false }, null, null)).toBe(false);
    expect(canOfferFestivalCheckIn(undefined, null, null)).toBe(false);
  });

  it("requires an authenticated account and an active character before purchase", () => {
    expect(canStartFestivalTicketPurchase(true, "character-one")).toBe(true);
    expect(canStartFestivalTicketPurchase(true, null)).toBe(false);
    expect(canStartFestivalTicketPurchase(false, "character-one")).toBe(false);
    expect(canStartFestivalTicketPurchase(false, null)).toBe(false);
  });
});
