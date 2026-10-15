import { describe, expect, it } from "vitest";
import { isUnderworldPurchaseSupported } from "@/utils/underworldPurchaseEligibility";

type Product = Parameters<typeof isUnderworldPurchaseSupported>[0];

const product: Product = {
  category: "consumable",
  duration_hours: null,
  effects: { health: -8, energy: 25 },
  price_cash: 180,
  is_available: true,
};

describe("underworld first-release catalog eligibility", () => {
  it("permits only bounded instant health, energy and fame effects", () => {
    expect(isUnderworldPurchaseSupported(product)).toBe(true);
    expect(isUnderworldPurchaseSupported({ ...product, effects: { fame: 150, health: -25, energy: 55 } })).toBe(true);
  });

  it("blocks boosters, collectibles and skill books", () => {
    for (const category of ["booster", "collectible", "skill_book"]) {
      expect(isUnderworldPurchaseSupported({ ...product, category })).toBe(false);
    }
  });

  it("fails closed for XP, multi-effect bonuses, negative duration and poisoned values", () => {
    expect(isUnderworldPurchaseSupported({ ...product, effects: { xp: 300 } })).toBe(false);
    expect(isUnderworldPurchaseSupported({ ...product, effects: { health: 30, gig_quality_boost: 10 } })).toBe(false);
    expect(isUnderworldPurchaseSupported({ ...product, duration_hours: -1 })).toBe(false);
    expect(isUnderworldPurchaseSupported({ ...product, effects: { energy: "30" } })).toBe(false);
    expect(isUnderworldPurchaseSupported({ ...product, effects: { energy: 1001 } })).toBe(false);
    expect(isUnderworldPurchaseSupported({ ...product, effects: {} })).toBe(false);
  });

  it("requires available, integer-priced stock catalog entries", () => {
    expect(isUnderworldPurchaseSupported({ ...product, is_available: false })).toBe(false);
    expect(isUnderworldPurchaseSupported({ ...product, price_cash: 0 })).toBe(false);
    expect(isUnderworldPurchaseSupported({ ...product, price_cash: 1000001 })).toBe(false);
  });
});
