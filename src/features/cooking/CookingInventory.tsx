import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
interface FoodEffectRow {
  effect_slug: string;
  effect_percent: number;
  expires_at: string;
}
interface ConsumptionResult {
  status: "completed" | "already_completed";
  consumptionId: string;
  remainingPortions: number;
  effectSlug: string;
  effectPercent: number;
  effectApplied: boolean;
  effectExpiresAt: string | null;
}
const formatExpiry = (iso: string) => new Date(iso).toLocaleString();
const prettyName = (name: string) => name.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());

export function CookingInventory() {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);
  // A timed-out browser response may still have consumed a portion.
  // Keep the request ID for a safe retry, never create a second debit.
  const pendingConsumptionIds = useRef(new Map<string, string>());

  const inventory = useQuery({
    queryKey: ["cooking-inventory", profileId],
    enabled: Boolean(profileId),
    queryFn: async () => {
      if (!profileId) return { ingredients: [] as IngredientRow[], food: [] as FoodRow[] };
      const [lots, batches] = await Promise.all([
        (supabase as any).from("cooking_ingredient_lots")
          .select("id,ingredient_slug,quantity,quality,expires_at")
          .eq("profile_id", profileId).order("expires_at"),
        (supabase as any).from("cooking_food_batches")
          .select("id,profile_id,recipe_slug,portions,quality,prepared_at,expires_at")
          .eq("profile_id", profileId).order("expires_at"),
      ]);
      if (lots.error) throw lots.error;
      if (batches.error) throw batches.error;
      return { ingredients: (lots.data ?? []) as IngredientRow[], food: (batches.data ?? []) as FoodRow[] };
    },
    refetchOnWindowFocus: true,
  });
  const effects = useQuery({
    queryKey: ["cooking-food-effects", profileId],
    enabled: Boolean(profileId),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cooking_active_food_effects")
        .select("effect_slug,effect_percent,expires_at")
        .eq("profile_id", profileId)
        .gt("expires_at", new Date().toISOString())
        .order("expires_at");
      if (error) throw error;
      return (data ?? []) as FoodEffectRow[];
    },
    refetchOnWindowFocus: true,
  });
  const consumeFood = useMutation({
    mutationFn: async (food: FoodRow) => {
      if (!profileId) throw new Error("Select an active character before eating.");
      const key = `${profileId}:${food.id}`;
      let requestId = pendingConsumptionIds.current.get(key);
      if (!requestId) {
        requestId = crypto.randomUUID();
        pendingConsumptionIds.current.set(key, requestId);
      }
      const { data, error } = await (supabase as any).rpc("consume_cooking_food_atomic", {
        p_profile_id: profileId,
        p_food_batch_id: food.id,
        p_request_id: requestId,
      });
      if (error) throw error;
      if (!data || !["completed", "already_completed"].includes(data.status))
        throw new Error("The cooking server did not confirm consumption.");
      pendingConsumptionIds.current.delete(key);
      return data as ConsumptionResult;
    },
    onSuccess: (result) => {
      const effectNotice = result.effectApplied && result.effectExpiresAt
        ? ` Food effect recorded until ${formatExpiry(result.effectExpiresAt)}.`
        : result.effectPercent > 0 ? " That benefit is already active and does not stack." : "";
      setFeedback(`One portion eaten. ${result.remainingPortions} portion(s) left.${effectNotice}`);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cooking-inventory", profileId] }),
        queryClient.invalidateQueries({ queryKey: ["cooking-food-effects", profileId] }),
      ]);
    },
    onError: (error: Error) => {
      setFeedback(`Could not eat this portion: ${error.message}`);
      void queryClient.invalidateQueries({ queryKey: ["cooking-inventory", profileId] });
    },
  });

  const now = Date.now();
  return <Card>
    <CardHeader>
      <CardTitle>Your kitchen inventory</CardTitle>
      <CardDescription>Ingredients and prepared meals are perishable. Eating consumes one portion; identical food effects never stack. Gameplay XP and recovery integrations are still being completed.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {!profileId && <p role="status">Select a character to see your inventory.</p>}
      {inventory.isLoading && <p role="status">Loading kitchen inventory…</p>}
      {inventory.isError && <p role="alert">Could not load kitchen inventory. Please try again later.</p>}
      {inventory.data && <>
        <section aria-label="Ingredients">
          <h3 className="font-semibold">Ingredient lots</h3>
          {inventory.data.ingredients.filter(lot => lot.quantity > 0).length === 0
            ? <p className="text-sm text-muted-foreground">No ingredients owned yet.</p>
            : <ul className="space-y-1">{inventory.data.ingredients.filter(lot => lot.quantity > 0).map(lot =>
              <li key={lot.id} className="text-sm">
                {prettyName(lot.ingredient_slug)} · {lot.quantity} units · Quality {lot.quality}/100 ·
                {" "}{Date.parse(lot.expires_at) <= now ? "Expired" : `Expires ${formatExpiry(lot.expires_at)}`}
              </li>)}</ul>}
        </section>
        <section aria-label="Prepared food">
          <h3 className="font-semibold">Prepared food</h3>
          {inventory.data.food.length === 0 ? <p className="text-sm text-muted-foreground">No food batches yet.</p>
            : <ul className="space-y-2">{inventory.data.food.map(food => {
              const batch: FoodBatch = {
                id: food.id, profileId: food.profile_id, recipeSlug: food.recipe_slug,
                portions: food.portions, quality: food.quality, preparedAt: food.prepared_at,
                expiresAt: food.expires_at,
              };
              const status = foodAvailability(batch, now);
              const canEat = status === "fresh" && food.portions > 0 && !consumeFood.isPending;
              return <li key={food.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                <div>
                  <strong>{prettyName(food.recipe_slug)}</strong>
                  <p>{food.portions} portions · Quality {food.quality}/100 ·
                    {" "}{status === "fresh" ? `Expires ${formatExpiry(food.expires_at)}` : status}
                  </p>
                </div>
                <Button type="button" size="sm" variant="secondary" disabled={!canEat || !profileId}
                  onClick={() => consumeFood.mutate(food)}>
                  {consumeFood.isPending ? "Confirming…" : food.portions < 1 ? "Finished" :
                    status !== "fresh" ? "Spoiled" : "Eat 1 portion"}
                </Button>
              </li>;
            })}</ul>}
        </section>
      </>}
      {effects.isError && <p role="alert">Could not load recorded food effects.</p>}
      {(effects.data ?? []).length > 0 && <section aria-label="Recorded food effects">
        <h3 className="font-semibold">Current food effects</h3>
        <ul className="space-y-1">{effects.data!.map(effect => <li key={effect.effect_slug} className="text-sm">
          {prettyName(effect.effect_slug)} · +{effect.effect_percent}% ·
          {" "}Expires {formatExpiry(effect.expires_at)}
        </li>)}</ul>
        <p className="text-xs text-muted-foreground">Practice XP food effects apply to scheduled practice covered for the full hour; rehearsal food effects apply to active rehearsal familiarity while the effect is active. Recovery, songwriting and focus still await settlement integration.</p>
      </section>}
      {feedback && <p role="status" className="text-sm">{feedback}</p>}
    </CardContent>
  </Card>;
}
