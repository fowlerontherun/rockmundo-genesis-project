import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { COOKING_RECIPES, getCookingRecipes, type RecipeCategory } from "./recipeCatalogue";

const categories: Array<RecipeCategory | "All"> = ["All", "Soups & stews", "Pies & baking", "Meals", "Drinks"];

export function CookingRecipeBook() {
  const [category, setCategory] = useState<RecipeCategory | "All">("All");
  return <Card>
    <CardHeader>
      <CardTitle>Recipe book</CardTitle>
      <CardDescription>{COOKING_RECIPES.length} proposed starter recipes. Preview only: ingredients, crafting and boosts are not live yet.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter recipes">
        {categories.map((item) => <button key={item} type="button"
          aria-pressed={category === item} onClick={() => setCategory(item)}
          className={`rounded-md border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${category === item ? "bg-secondary font-semibold" : ""}`}>
          {item}
        </button>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {getCookingRecipes(category).map((recipe) => <article key={recipe.slug} className="rounded-lg border p-4 space-y-2">
          <h3 className="font-semibold">{recipe.name}</h3>
          <p className="text-sm text-muted-foreground">{recipe.region} · {recipe.method} · {recipe.portions} portions</p>
          <p className="text-sm"><strong>Ingredients:</strong> {recipe.ingredients.join(", ")}</p>
          <p className="text-sm"><strong>Proposed effect:</strong> {recipe.buff} for {recipe.buffHours} hours</p>
          <p className="text-sm"><strong>Base shelf life:</strong> {recipe.shelfLifeHours / 24} day(s), subject to ingredient freshness</p>
        </article>)}
      </div>
      <p className="text-xs text-muted-foreground">No recipe can be started from this preview. Final recipes, prices, storage limits and effect caps require server-side implementation and balancing.</p>
    </CardContent>
  </Card>;
}
