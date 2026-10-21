import { useQuery } from "@tanstack/react-query";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { foodAvailability, type FoodBatch } from "./foodBatchRules";

interface IngredientRow {
  id: string;
  ingredient_slug: string;
  quantity: number;
  quality: number;
  expires_at: string;
}
interface FoodRow {
  id: string;
  profile_id: string;
  recipe_slug: string;
  portions: number;
  quality: number;
  prepared_at: string;
  expires_at: string;
}
const formatExpiry = (iso: string) => new Date(iso).toLocaleString();

export function CookingInventory() {
  const { profileId } = useActiveProfile();
  const inventory = useQuery({
    queryKey: ["cooking-inventory", profileId],
    enabled: Boolean(profileId),
    queryFn: async () => {
      if (!profileId) return { ingredients: [] as IngredientRow[], food: [] as FoodRow[] };
      // Generated Supabase types will be refreshed once the migration lands in main.
      const [lots, batches] = await Promise.all([
        (supabase as any).from("cooking_ingredient_lots").select("id,ingredient_slug,quantity,quality,expires_at").eq("profile_id", profileId).order("expires_at"),
        (supabase as any).from("cooking_food_batches").select("id,profile_id,recipe_slug,portions,quality,prepared_at,expires_at").eq("profile_id", profileId).order("expires_at"),
      ]);
      if (lots.error) throw lots.error;
      if (batches.error) throw batches.error;
      return { ingredients: lots.data as IngredientRow[], food: batches.data as FoodRow[] };
    },
  });
  const now = Date.now();
  return <Card>
    <CardHeader>
      <CardTitle>Your kitchen inventory</CardTitle>
      <CardDescription>Read-only ingredients and cooked batches. Real cooking, eating and trading are not enabled yet.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {!profileId && <p role="status">Select a character to see your inventory.</p>}
      {inventory.isLoading && <p role="status">Loading kitchen inventory…</p>}
      {inventory.isError && <p role="alert">Could not load kitchen inventory. Please try again later.</p>}
      {inventory.data && <>
        <section aria-label="Ingredients">
          <h3 className="font-semibold">Ingredient lots</h3>
          {inventory.data.ingredients.length === 0 ? <p className="text-sm text-muted-foreground">No ingredients owned yet.</p> :
            <ul className="space-y-1">{inventory.data.ingredients.map((lot) => <li key={lot.id} className="text-sm">
              {lot.ingredient_slug} · {lot.quantity} units · Quality {lot.quality}/100 · {Date.parse(lot.expires_at) <= now ? "Expired" : `Expires ${formatExpiry(lot.expires_at)}`}
            </li>)}</ul>}
        </section>
        <section aria-label="Prepared food">
          <h3 className="font-semibold">Prepared food</h3>
          {inventory.data.food.length === 0 ? <p className="text-sm text-muted-foreground">No food batches yet.</p> :
            <ul className="space-y-1">{inventory.data.food.map((food) => {
              const batch: FoodBatch = { id: food.id, profileId: food.profile_id, recipeSlug: food.recipe_slug,
                portions: food.portions, quality: food.quality, preparedAt: food.prepared_at, expiresAt: food.expires_at };
              return <li key={food.id} className="text-sm">{food.recipe_slug} · {food.portions} portions · Quality {food.quality}/100 · {foodAvailability(batch, now) === "fresh" ? `Expires ${formatExpiry(food.expires_at)}` : foodAvailability(batch, now)}</li>;
            })}</ul>}
        </section>
      </>}
    </CardContent>
  </Card>;
}
