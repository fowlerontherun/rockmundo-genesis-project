import { Clock, Droplets, Salad, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { WellnessVitals } from "@/lib/api/wellnessActivities";
import { buildNutritionSnapshot, DEFAULT_FOOD_DEFINITIONS, describeMealForPlayer, FOOD_WELLNESS_BALANCE, type MealEvent } from "@/lib/foodWellness";

const demoNow = new Date();

function sampleRecentMeals(nutrition?: number): MealEvent[] {
  const recent = new Date(demoNow.getTime() - 3 * 36e5);
  const fallback = nutrition !== undefined && nutrition < 45 ? "budget_fast_food" : "standard_restaurant_meal";
  const meal = DEFAULT_FOOD_DEFINITIONS.find((f) => f.id === fallback)!;
  return [{ id: "current-summary-meal", food: meal, consumedAt: recent, sourceQuality: 64, serviceQuality: 62, cleanliness: 66, paidCents: meal.cost_cents, applied: true }];
}

export default function NutritionHydrationPanel({ vitals }: { vitals: WellnessVitals | null }) {
  const recentMeals = sampleRecentMeals(vitals?.nutrition);
  const snapshot = buildNutritionSnapshot(recentMeals, demoNow, vitals?.nutrition ?? 68, 78);
  const mealPlan = (vitals?.nutrition ?? 68) < 50 ? "Balanced meal plan recommended" : "Manual / balanced meal rhythm";
  const nextAction = snapshot.warning ?? "Drink water freely and keep two meaningful meals in today's plan.";

  return (
    <Card className="border-emerald-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Salad className="h-4 w-4 text-emerald-600" /> Nutrition & hydration</CardTitle>
        <p className="text-xs text-muted-foreground">Rolling food state uses recent meals, hydration, meal timing and workload. Effects are server-authoritative and capped, not client-submitted.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border p-3">
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><Utensils className="h-3 w-3" /> Nutrition state</p>
            <p className="font-semibold">{snapshot.nutritionState}</p>
            <Progress value={snapshot.nutritionScore} aria-label={`Nutrition score ${snapshot.nutritionScore} out of 100`} className="mt-2" />
          </div>
          <div className="rounded-lg border p-3">
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><Droplets className="h-3 w-3" /> Hydration state</p>
            <p className="font-semibold">{snapshot.hydrationState}</p>
            <Progress value={snapshot.hydrationScore} aria-label={`Hydration score ${snapshot.hydrationScore} out of 100`} className="mt-2" />
          </div>
          <div className="rounded-lg border p-3">
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> Meal timing</p>
            <p className="font-semibold">{snapshot.mealTimingState}</p>
            <p className="text-xs text-muted-foreground">{snapshot.meaningfulMealsToday}/{FOOD_WELLNESS_BALANCE.dailyMeaningfulMealsExpected} meaningful meals today</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Current plan</p>
            <p className="font-semibold">{mealPlan}</p>
            <p className="text-xs text-muted-foreground">Free water is always available; paid food validates funds server-side.</p>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-sm font-medium">Suggested next action</p>
          <p className="text-sm text-muted-foreground">{nextAction}</p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Recent meals</h3>
            <div className="space-y-2">
              {recentMeals.map((meal) => {
                const labels = describeMealForPlayer(meal.food);
                return (
                  <div key={meal.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{meal.food.name}</span>
                      <Badge variant="outline">{labels.nutrition}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Source: {meal.food.source_type.split("_").join(" ")} · Cost ${(meal.paidCents ?? meal.food.cost_cents) / 100} · {labels.energy} · {labels.hydration} · {labels.fullness}</p>
                    <p className="text-xs text-muted-foreground">Use: {labels.recommendedUse}. Remaining short-term effect is capped by recent meal stacking.</p>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Today's plan</h3>
            <div className="space-y-2 text-sm">
              <div className="rounded-lg border p-3"><strong>Hydration:</strong> free water refill available before travel, rehearsal and gigs.</div>
              <div className="rounded-lg border p-3"><strong>Meal gap forecast:</strong> next major activity should include a light or standard meal if more than 5 hours away.</div>
              <div className="rounded-lg border p-3"><strong>Automation:</strong> budget, balanced, performance, recovery and luxury plans choose existing local food options within configured spending caps.</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
