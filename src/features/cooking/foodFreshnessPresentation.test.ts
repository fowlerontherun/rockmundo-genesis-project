import { describe, expect, it } from "vitest";
import {
  freshnessUrgency, remainingFreshnessPercent, summarizeKitchenFreshness,
  timeUntilSpoiled,
} from "./foodFreshnessPresentation";

const now = Date.parse("2026-10-26T10:00:00Z");
const expiryIn = (hours: number) => new Date(now + hours * 3_600_000).toISOString();

describe("perishable kitchen dashboard presentation", () => {
  it("switches correctly at expiry and urgency boundaries", () => {
    expect(freshnessUrgency(expiryIn(24.01),now)).toBe("fresh");
    expect(freshnessUrgency(expiryIn(24),now)).toBe("soon");
    expect(freshnessUrgency(expiryIn(6.01),now)).toBe("soon");
    expect(freshnessUrgency(expiryIn(6),now)).toBe("urgent");
    expect(freshnessUrgency(expiryIn(0),now)).toBe("expired");
    expect(freshnessUrgency(expiryIn(-1),now)).toBe("expired");
    expect(freshnessUrgency("invalid",now)).toBe("expired");
  });

  it("shows human-readable time remaining without rounding away final minutes", () => {
    expect(timeUntilSpoiled(expiryIn(0),now)).toBe("Expired");
    expect(timeUntilSpoiled(expiryIn(1 / 120),now)).toBe("1 min left");
    expect(timeUntilSpoiled(expiryIn(0.5),now)).toBe("30 min left");
    expect(timeUntilSpoiled(expiryIn(2.5),now)).toBe("2 hr 30 min left");
    expect(timeUntilSpoiled(expiryIn(24),now)).toBe("24 hr left");
    expect(timeUntilSpoiled(expiryIn(49),now)).toBe("2d 1h left");
  });

  it("only renders a truthful freshness percentage with valid preparation dates", () => {
    const prepared = expiryIn(-24);
    expect(remainingFreshnessPercent(prepared,expiryIn(24),now)).toBe(50);
    expect(remainingFreshnessPercent(prepared,expiryIn(-3),now)).toBe(0);
    expect(remainingFreshnessPercent(expiryIn(24),expiryIn(48),now)).toBeNull();
    expect(remainingFreshnessPercent("invalid",expiryIn(48),now)).toBeNull();
    expect(remainingFreshnessPercent(prepared,prepared,now)).toBeNull();
  });

  it("summarizes unexpired portions and ingredient units without counting empty lots", () => {
    const ingredients = [
      { quantity: 4, expires_at: expiryIn(5) },
      { quantity: 3, expires_at: expiryIn(72) },
      { quantity: 6, expires_at: expiryIn(-1) },
      { quantity: 0, expires_at: expiryIn(1) },
    ];
    const meals = [
      { portions: 2, expires_at: expiryIn(5) },
      { portions: 3, expires_at: expiryIn(20) },
      { portions: 6, expires_at: expiryIn(72) },
      { portions: 2, expires_at: expiryIn(-1) },
      { portions: 0, expires_at: expiryIn(1) },
    ];
    expect(summarizeKitchenFreshness(ingredients,meals,now)).toEqual({
      usableIngredients: 7, soonIngredientUnits: 4,
      readyPortions: 11, soonPortions: 5, spoiledPortions: 2,
    });
    expect(ingredients[0].quantity).toBe(4);
    expect(meals[0].portions).toBe(2);
  });
});
