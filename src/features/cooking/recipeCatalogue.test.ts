import { describe, expect, it } from "vitest";
import { COOKING_RECIPES, getCookingRecipes } from "./recipeCatalogue";

describe("cooking recipe preview catalogue", () => {
  it("has twelve uniquely identifiable legal starter recipes", () => {
    expect(COOKING_RECIPES).toHaveLength(12);
    expect(new Set(COOKING_RECIPES.map((recipe) => recipe.slug)).size).toBe(12);
    expect(COOKING_RECIPES.every((recipe) => recipe.ingredients.length >= 3)).toBe(true);
  });
  it("retains bounded output and expiry for every recipe", () => {
    expect(COOKING_RECIPES.every((recipe) => recipe.portions >= 1 && recipe.portions <= 6)).toBe(true);
    expect(COOKING_RECIPES.every((recipe) => recipe.shelfLifeHours > 0 && recipe.shelfLifeHours <= 72)).toBe(true);
  });
  it("filters by food category without changing catalogue", () => {
    expect(getCookingRecipes("Drinks")).toHaveLength(2);
    expect(getCookingRecipes("Pies & baking")).toHaveLength(4);
    expect(getCookingRecipes()).toHaveLength(COOKING_RECIPES.length);
  });
});
