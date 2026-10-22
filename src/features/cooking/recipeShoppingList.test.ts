import { describe, expect, it } from "vitest";
import { calculateCookingShoppingList } from "./recipeShoppingList";

const now = Date.parse("2026-10-22T12:00:00.000Z");
const activeOffer = (ingredient_slug: string, stock = 10, unit_price = 5) => ({
  ingredient_slug, stock, unit_price, is_active: true, local_speciality: true,
});
const freshLot = (ingredient_slug: string, quantity: number, hours = 24) => ({
  ingredient_slug, quantity,
  expires_at: new Date(now + hours * 3600000).toISOString(),
});
const ingredients = [
  { ingredient_slug: "rice", units_required: 2 },
  { ingredient_slug: "mushrooms", units_required: 1 },
  { ingredient_slug: "soy-seasoning", units_required: 1 },
];

describe("cooking recipe shopping list", () => {
  it("uses only non-expired ingredient lots and prices exact missing units", () => {
    const summary = calculateCookingShoppingList(ingredients, [
      freshLot("rice", 1),
      freshLot("rice", 100, -1),
      freshLot("mushrooms", 1),
      freshLot("soy-seasoning", 1),
    ], [activeOffer("rice", 10, 7), activeOffer("mushrooms", 10, 9),
      activeOffer("soy-seasoning", 10, 12)], now);
    expect(summary.canCook).toBe(false);
    expect(summary.canBuyMissingLocally).toBe(true);
    expect(summary.shoppingCost).toBe(7);
    expect(summary.missingTotal).toBe(1);
    expect(summary.lines[0]).toMatchObject({
      slug: "rice", required: 2, owned: 1, missing: 1, subtotal: 7,
    });
  });
  it("requires no purchase when enough fresh food already belongs to a character", () => {
    const summary = calculateCookingShoppingList(ingredients, [
      freshLot("rice", 2),freshLot("mushrooms", 2),freshLot("soy-seasoning", 1),
    ], [], now);
    expect(summary).toMatchObject({
      canCook: true, canBuyMissingLocally: true, missingTotal: 0, shoppingCost: 0,
    });
  });
  it("never quotes closed or insufficient market stock as buyable", () => {
    const summary = calculateCookingShoppingList(ingredients, [], [
      { ...activeOffer("rice", 10, 2), is_active: false },
      activeOffer("mushrooms", 1, 9),
      activeOffer("soy-seasoning", 0, 10),
    ], now);
    expect(summary.canCook).toBe(false);
    expect(summary.canBuyMissingLocally).toBe(false);
    expect(summary.shoppingCost).toBe(null);
    expect(summary.lines.find(line => line.slug === "rice")?.subtotal).toBe(null);
  });
  it("does not treat spoiled or zero-quantity lots as available", () => {
    const summary = calculateCookingShoppingList([
      { ingredient_slug: "milk", units_required: 1 },
    ], [freshLot("milk", 1, -2), freshLot("milk", 0)], [], now);
    expect(summary.lines[0]).toMatchObject({ owned: 0, missing: 1 });
  });
  it("does not mark a recipe with no known ingredients as ready", () => {
    const summary = calculateCookingShoppingList([], [], [], now);
    expect(summary.canCook).toBe(false);
    expect(summary.canBuyMissingLocally).toBe(false);
  });
});
