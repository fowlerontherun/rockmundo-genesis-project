import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBasket, CheckCircle2, MapPin } from "lucide-react";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { calculateCookingShoppingList, type ShoppingRequirement,
  type OwnedIngredientLot, type ShoppingCityOffer } from "./recipeShoppingList";

interface Recipe { slug: string; name: string; portions: number }
const formatIngredient = (slug: string) =>
  slug.replace(/[-_]/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());

/** Read-only recipe shopping guidance; purchases continue through the existing
 * authenticated, idempotent market purchase RPC in CookingCityMarket. */
export function CookingRecipeShoppingList() {
  const { profile, profileId } = useActiveProfile();
  const cityId = profile?.current_city_id ?? null;
  const [requestedSlug, setRequestedSlug] = useState("");

  const recipes = useQuery({
    queryKey: ["cooking-shopping-recipes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("cooking_recipes")
        .select("slug,name,portions").eq("is_active", true).eq("method", "pan").order("name");
      if (error) throw error;
      return (data ?? []) as Recipe[];
    },
    staleTime: 30_000,
  });
  const enabledRecipes = recipes.data ?? [];
  const recipeSlug = enabledRecipes.find(recipe => recipe.slug === requestedSlug)?.slug ??
    enabledRecipes[0]?.slug ?? "";

  const requirements = useQuery({
    queryKey: ["cooking-shopping-recipe", recipeSlug],
    enabled: Boolean(recipeSlug),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cooking_recipe_ingredients")
        .select("ingredient_slug,units_required")
        .eq("recipe_slug", recipeSlug).order("ingredient_slug");
      if (error) throw error;
      return (data ?? []) as ShoppingRequirement[];
    },
    staleTime: 30_000,
  });

  const availableStock = useQuery({
    queryKey: ["cooking-shopping-list", profileId, cityId],
    enabled: Boolean(profileId && cityId && recipeSlug),
    queryFn: async () => {
      const [lotResult, offerResult] = await Promise.all([
        (supabase as any).from("cooking_ingredient_lots")
          .select("ingredient_slug,quantity,expires_at")
          .eq("profile_id", profileId).gt("quantity", 0),
        (supabase as any).from("cooking_city_market_offers")
          .select("ingredient_slug,stock,unit_price,is_active,local_speciality")
          .eq("city_id", cityId).eq("is_active", true),
      ]);
      if (lotResult.error) throw lotResult.error;
      if (offerResult.error) throw offerResult.error;
      return {
        lots: (lotResult.data ?? []) as OwnedIngredientLot[],
        offers: (offerResult.data ?? []) as ShoppingCityOffer[],
      };
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const summary = requirements.data && availableStock.data
    ? calculateCookingShoppingList(
      requirements.data, availableStock.data.lots,
      availableStock.data.offers, Date.now())
    : null;

  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <ShoppingBasket className="h-5 w-5" />Recipe shopping list
      </CardTitle>
      <CardDescription>
        See how much fresh produce you already own and what you need to buy locally.
        Shopping guidance never charges your character or starts cooking.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {!profileId || !cityId
        ? <p className="text-sm text-muted-foreground">Choose a character currently in a city to plan shopping.</p>
        : recipes.isLoading
        ? <p role="status" className="text-sm">Looking for unlocked pan recipes…</p>
        : recipes.isError
        ? <p role="alert" className="text-sm text-destructive">Could not load your available recipes.</p>
        : !enabledRecipes.length
        ? <p role="status" className="text-sm text-muted-foreground">
            No production cooking recipes are enabled yet. The free kitchen and recipe previews remain available.
          </p>
        : <>
            <label className="block space-y-1 text-sm font-medium" htmlFor="cooking-shopping-recipe">
              Recipe
              <select id="cooking-shopping-recipe"
                className="block w-full rounded-md border bg-background p-2"
                value={recipeSlug} onChange={event => setRequestedSlug(event.target.value)}>
                {enabledRecipes.map(recipe =>
                  <option key={recipe.slug} value={recipe.slug}>{recipe.name} — {recipe.portions} portions</option>)}
              </select>
            </label>
            {(requirements.isLoading || availableStock.isLoading) &&
              <p role="status" className="text-sm">Checking ingredients and city market…</p>}
            {(requirements.isError || availableStock.isError) &&
              <p role="alert" className="text-sm text-destructive">Ingredient availability could not be verified.</p>}
            {summary && <>
              <div className="space-y-2">
                {summary.lines.map(line =>
                  <div key={line.slug} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                    <div>
                      <strong>{formatIngredient(line.slug)}</strong>
                      <p className="text-muted-foreground">
                        Need {line.required} · Fresh owned {line.owned}
                        {line.localSpeciality ? " · Local speciality" : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      {line.missing === 0
                        ? <span className="flex items-center gap-1 text-sm">
                            <CheckCircle2 className="h-4 w-4" />Ready
                          </span>
                        : <p className="font-medium">Missing {line.missing}</p>}
                      {line.missing > 0 && <p className="text-xs text-muted-foreground">
                        {line.subtotal === null
                          ? line.localStock === 0 ? "Not on sale here" : "Insufficient local stock"
                          : `Available here for $${line.subtotal}`}
                      </p>}
                    </div>
                  </div>)}
              </div>
              {summary.canCook
                ? <p role="status" className="text-sm font-medium">
                    You have the ingredients for this recipe. Use the live kitchen to start cooking.
                  </p>
                : <p role="status" className="text-sm">
                    {summary.missingTotal} additional unit(s) needed.
                    {summary.canBuyMissingLocally
                      ? ` Available in this city for $${summary.shoppingCost} total.`
                      : " Some ingredients are not available in this city's active market."}
                  </p>}
              {!summary.canCook && <a href="#cooking-city-market"
                className="inline-flex items-center gap-2 text-sm underline underline-offset-4">
                <MapPin className="h-4 w-4" />View market stock and purchase ingredients
              </a>}
              <p className="text-xs text-muted-foreground">
                Freshness and local stock can change. Final stock, price and payment
                are checked by the server when you buy or start cooking.
              </p>
            </>}
          </>}
    </CardContent>
  </Card>;
}
