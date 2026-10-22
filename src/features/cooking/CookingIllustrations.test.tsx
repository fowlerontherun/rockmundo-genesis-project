import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { COOKING_RECIPES } from "./recipeCatalogue";
import { CookingEquipmentScene, CookingStageGuide } from "./CookingEquipmentScene";
import { DishIllustration, IngredientIllustration } from "./CookingIllustrations";
import { ILLUSTRATED_INGREDIENTS, dishShape, dishSurfaceColor, ingredientVisual } from "./cookingVisualCatalogue";

afterEach(cleanup);

describe("shared Rockmundo cooking illustrations", () => {
  it("provides intentional visuals for every one of the 26 market ingredients", () => {
    expect(ILLUSTRATED_INGREDIENTS).toHaveLength(26);
    for (const slug of ILLUSTRATED_INGREDIENTS) {
      const item = ingredientVisual(slug);
      expect(item.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(item.accent).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(ingredientVisual("Flour")).toEqual(ingredientVisual("flour"));
    expect(ingredientVisual("Soy Seasoning")).toEqual(ingredientVisual("soy-seasoning"));
    expect(ingredientVisual("unknown-ingredient").form).toBe("powder");
  });

  it("visually distinguishes every starter recipe family", () => {
    const shapes = new Set(COOKING_RECIPES.map(recipe => dishShape(recipe.slug)));
    expect(shapes).toEqual(new Set(["pie", "cake", "soup", "stew", "drink", "bowl"]));
    expect(COOKING_RECIPES).toHaveLength(12);
  });

  it("renders accessible food illustrations without network images", () => {
    render(<div>
      <IngredientIllustration slug="mushrooms" />
      <IngredientIllustration slug="rice" size="small" />
      <DishIllustration recipeSlug="apple-pie" />
      <DishIllustration recipeSlug="tomato-soup" stage="Burnt" />
    </div>);
    expect(screen.getByRole("img", { name: "mushrooms ingredient illustration" })).toBeVisible();
    expect(screen.getByRole("img", { name: "rice ingredient illustration" })).toBeVisible();
    expect(screen.getByRole("img", { name: "apple pie ready dish illustration" })).toBeVisible();
    expect(screen.getByRole("img", { name: "tomato soup burnt dish illustration" })).toBeVisible();
    expect(document.querySelectorAll("img")).toHaveLength(0);
    expect(document.querySelectorAll("svg")).toHaveLength(4);
  });

  it("communicates burning with distinguishable visual states AND labels", () => {
    expect(dishSurfaceColor("Raw")).not.toBe(dishSurfaceColor("Burnt"));
    expect(dishSurfaceColor("Ready")).not.toBe(dishSurfaceColor("Overdone"));
    const view = render(<CookingStageGuide stage="Burnt" />);
    const guide = screen.getByLabelText("Cooking progress: Burnt");
    expect(within(guide).getByText("Burnt").parentElement).toHaveAttribute("aria-current", "step");
    view.rerender(<CookingStageGuide stage="Cooking" />);
    const warming = within(screen.getByLabelText("Cooking progress: Cooking")).getByText("Warming");
    expect(warming.parentElement).toHaveAttribute("aria-current", "step");
  });

  it.each(["oven", "simmer", "mix"] as const)(
    "uses a unique %s equipment scene with a contextual finished dish",
    method => {
      render(<CookingEquipmentScene method={method} recipeSlug={
        method === "oven" ? "apple-pie" : method === "simmer" ? "onion-soup" : "fruit-drink"
      } stage="Ready" heating={method !== "mix"} hasIngredients={true} stirring={method === "mix"} />);
      const art = screen.getByTestId("cooking-equipment-scene");
      expect(art).toHaveAttribute("data-method", method);
      expect(art).toHaveAttribute("data-stage", "Ready");
      expect(within(art).getByTestId("cooking-dish-art")).toBeVisible();
      expect(within(art).getByRole("img", { name: /ready dish illustration/i })).toBeVisible();
    },
  );

  it("does not depict food in an empty preparation vessel", () => {
    render(<CookingEquipmentScene method="oven" recipeSlug="apple-pie"
      stage="Raw" heating={false} stirring={false} hasIngredients={false} />);
    expect(screen.getByText("Add recipe ingredients")).toBeVisible();
    expect(screen.queryByTestId("cooking-dish-art")).toBeNull();
  });
});
