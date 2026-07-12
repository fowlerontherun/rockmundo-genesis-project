import { clampWellness, getWellnessTier, type WellnessCoreValues, type WellnessTierKey } from "@/lib/wellnessSystem";

export type MealCategory = "snack" | "light_meal" | "standard_meal" | "healthy_meal" | "high_protein_meal" | "comfort_food" | "fast_food" | "luxury_meal" | "recovery_meal" | "breakfast" | "pre_performance_meal" | "post_performance_meal" | "travel_meal";
export type FoodSourceType = "restaurant" | "home_cooking" | "prepared_meal" | "grocery" | "accommodation" | "tour_catering" | "venue_catering" | "hydration";
export type NutritionState = "Excellent" | "Well nourished" | "Adequate" | "Poor" | "Deficient";
export type HydrationState = "Fully hydrated" | "Hydrated" | "Slightly dehydrated" | "Dehydrated" | "Severely dehydrated";
export type MealTimingState = "Recently ate" | "Properly fed" | "Getting hungry" | "Hungry" | "Very hungry";
export type MealPlanType = "manual" | "budget" | "balanced" | "performance" | "recovery" | "luxury";
export type TourCateringTier = "self_catered" | "budget" | "standard" | "performance" | "premium";

export interface FoodDefinition {
  id: string;
  name: string;
  category: MealCategory;
  nutrition_value: number;
  energy_value: number;
  hydration_value: number;
  satiety: number;
  meal_quality: number;
  preparation_quality: number;
  freshness: number;
  portion_size: number;
  sugar_load: number;
  stimulant_level: number;
  alcohol_content: number;
  recovery_support: number;
  stress_effect: number;
  cost_cents: number;
  consumption_duration_minutes: number;
  availability_window?: string[];
  dietary_tags: string[];
  source_type: FoodSourceType;
  unlock_tier: WellnessTierKey;
}

export interface MealEvent {
  id: string;
  food: FoodDefinition;
  consumedAt: Date;
  sourceQuality?: number;
  serviceQuality?: number;
  cleanliness?: number;
  paidCents?: number;
  applied?: boolean;
  suitableFor?: "pre_performance" | "post_performance" | "travel" | "recovery";
}

export interface NutritionSnapshot {
  nutritionScore: number;
  hydrationScore: number;
  nutritionState: NutritionState;
  hydrationState: HydrationState;
  mealTimingState: MealTimingState;
  lastMeaningfulMealAt: Date | null;
  meaningfulMealsToday: number;
  warning: string | null;
  suggestedAction: string;
}

export const FOOD_WELLNESS_BALANCE = {
  nutritionThresholds: [
    { state: "Excellent" as const, min: 86 },
    { state: "Well nourished" as const, min: 72 },
    { state: "Adequate" as const, min: 50 },
    { state: "Poor" as const, min: 30 },
    { state: "Deficient" as const, min: 0 },
  ],
  hydrationThresholds: [
    { state: "Fully hydrated" as const, min: 88 },
    { state: "Hydrated" as const, min: 70 },
    { state: "Slightly dehydrated" as const, min: 50 },
    { state: "Dehydrated" as const, min: 30 },
    { state: "Severely dehydrated" as const, min: 0 },
  ],
  mealTimingHours: { recentlyAte: 2, properlyFed: 5, gettingHungry: 8, hungry: 12 },
  dailyMeaningfulMealsExpected: 2,
  recoveryModifierCaps: { bonus: 0.1, penalty: -0.15, severePenalty: -0.22 },
  performanceModifierCaps: { bonus: 0.06, penalty: -0.12, severePenalty: -0.18 },
  restaurantQualityInfluence: { min: -0.12, max: 0.12 },
  hydrationDriftPerHour: 1.1,
  workloadHydrationDemand: { exercise: 10, rehearsal: 7, gig: 12, travel: 5, recording: 4 },
  preparedMealFreshHours: 48,
  stacking: { maxMealsPerSixHours: 2, duplicateCategoryPenalty: 0.35 },
  planBudgetsCents: { manual: 0, budget: 1800, balanced: 3800, performance: 5200, recovery: 5600, luxury: 12000 },
} as const;

export const DEFAULT_FOOD_DEFINITIONS: FoodDefinition[] = [
  { id: "free_water", name: "Water refill", category: "snack", nutrition_value: 0, energy_value: 0, hydration_value: 28, satiety: 2, meal_quality: 55, preparation_quality: 70, freshness: 100, portion_size: 1, sugar_load: 0, stimulant_level: 0, alcohol_content: 0, recovery_support: 2, stress_effect: 0, cost_cents: 0, consumption_duration_minutes: 5, dietary_tags: ["hydration", "free"], source_type: "hydration", unlock_tier: "new_artist" },
  { id: "budget_fast_food", name: "Budget fast-food meal", category: "fast_food", nutrition_value: 32, energy_value: 10, hydration_value: 2, satiety: 62, meal_quality: 35, preparation_quality: 45, freshness: 70, portion_size: 1.05, sugar_load: 55, stimulant_level: 8, alcohol_content: 0, recovery_support: -4, stress_effect: -2, cost_cents: 900, consumption_duration_minutes: 20, dietary_tags: ["quick", "cheap"], source_type: "restaurant", unlock_tier: "new_artist" },
  { id: "standard_restaurant_meal", name: "Standard restaurant meal", category: "standard_meal", nutrition_value: 58, energy_value: 7, hydration_value: 6, satiety: 72, meal_quality: 60, preparation_quality: 60, freshness: 78, portion_size: 1, sugar_load: 18, stimulant_level: 0, alcohol_content: 0, recovery_support: 4, stress_effect: -3, cost_cents: 2200, consumption_duration_minutes: 40, dietary_tags: ["balanced"], source_type: "restaurant", unlock_tier: "new_artist" },
  { id: "home_balanced_meal", name: "Home-cooked balanced meal", category: "healthy_meal", nutrition_value: 70, energy_value: 6, hydration_value: 8, satiety: 75, meal_quality: 70, preparation_quality: 62, freshness: 86, portion_size: 1, sugar_load: 10, stimulant_level: 0, alcohol_content: 0, recovery_support: 8, stress_effect: -2, cost_cents: 750, consumption_duration_minutes: 55, dietary_tags: ["balanced", "home"], source_type: "home_cooking", unlock_tier: "active_musician" },
  { id: "pre_gig_light_meal", name: "Pre-performance light meal", category: "pre_performance_meal", nutrition_value: 64, energy_value: 8, hydration_value: 10, satiety: 58, meal_quality: 68, preparation_quality: 65, freshness: 86, portion_size: 0.85, sugar_load: 12, stimulant_level: 5, alcohol_content: 0, recovery_support: 5, stress_effect: -1, cost_cents: 1800, consumption_duration_minutes: 25, dietary_tags: ["pre-gig", "light"], source_type: "restaurant", unlock_tier: "active_musician" },
  { id: "post_show_recovery_bowl", name: "Post-show recovery meal", category: "post_performance_meal", nutrition_value: 78, energy_value: 5, hydration_value: 12, satiety: 82, meal_quality: 76, preparation_quality: 70, freshness: 88, portion_size: 1, sugar_load: 8, stimulant_level: 0, alcohol_content: 0, recovery_support: 18, stress_effect: -4, cost_cents: 3200, consumption_duration_minutes: 35, dietary_tags: ["recovery", "high nutrition"], source_type: "restaurant", unlock_tier: "professional_artist" },
  { id: "premium_catering", name: "Premium catering plate", category: "luxury_meal", nutrition_value: 82, energy_value: 6, hydration_value: 10, satiety: 80, meal_quality: 84, preparation_quality: 82, freshness: 90, portion_size: 1, sugar_load: 10, stimulant_level: 0, alcohol_content: 0, recovery_support: 12, stress_effect: -7, cost_cents: 8000, consumption_duration_minutes: 30, dietary_tags: ["catering", "luxury"], source_type: "tour_catering", unlock_tier: "superstar" },
];

export function stateFromScore<T extends string>(score: number, thresholds: readonly { state: T; min: number }[]): T {
  return thresholds.find((t) => score >= t.min)?.state ?? thresholds[thresholds.length - 1].state;
}

export function getMealTimingState(lastMealAt: Date | null, now = new Date()): MealTimingState {
  if (!lastMealAt) return "Very hungry";
  const hours = Math.max(0, (now.getTime() - lastMealAt.getTime()) / 36e5);
  const h = FOOD_WELLNESS_BALANCE.mealTimingHours;
  if (hours <= h.recentlyAte) return "Recently ate";
  if (hours <= h.properlyFed) return "Properly fed";
  if (hours <= h.gettingHungry) return "Getting hungry";
  if (hours <= h.hungry) return "Hungry";
  return "Very hungry";
}

export function getRestaurantQualityMultiplier(input: { quality?: number; staffQuality?: number; cleanliness?: number; serviceQuality?: number; ingredientQuality?: number }) {
  const average = [input.quality, input.staffQuality, input.cleanliness, input.serviceQuality, input.ingredientQuality].filter((v): v is number => typeof v === "number").reduce((a, b, _, arr) => a + b / arr.length, 0) || 60;
  const raw = (average - 60) / 100;
  return Number(Math.max(FOOD_WELLNESS_BALANCE.restaurantQualityInfluence.min, Math.min(FOOD_WELLNESS_BALANCE.restaurantQualityInfluence.max, raw)).toFixed(3));
}

export function calculateMealEffect(event: MealEvent, recentEvents: MealEvent[] = []) {
  const qualityMod = event.food.source_type === "restaurant" ? getRestaurantQualityMultiplier({ quality: event.sourceQuality, cleanliness: event.cleanliness, serviceQuality: event.serviceQuality }) : 0;
  const repeated = recentEvents.filter((m) => m.food.category === event.food.category).length;
  const repeatMult = repeated > 0 ? 1 - FOOD_WELLNESS_BALANCE.stacking.duplicateCategoryPenalty : 1;
  const freshnessMult = event.food.freshness < 40 ? 0.65 : event.food.freshness < 70 ? 0.85 : 1;
  const cappedMult = Math.max(0.4, Math.min(1.15, (1 + qualityMod) * repeatMult * freshnessMult));
  return {
    nutrition: Math.round(event.food.nutrition_value * cappedMult),
    energy: Math.round(event.food.energy_value * cappedMult),
    hydration: Math.round(event.food.hydration_value * cappedMult - event.food.alcohol_content * 0.4),
    satiety: Math.round(event.food.satiety * cappedMult),
    recoverySupport: Math.round(event.food.recovery_support * cappedMult),
    stress: Math.round(event.food.stress_effect * cappedMult),
    happiness: Math.round(Math.max(-4, Math.min(8, (event.food.meal_quality - 50) / 10 - event.food.alcohol_content / 25))),
    conditionRisk: Math.max(0, Math.min(0.08, (45 - (event.cleanliness ?? event.food.preparation_quality)) / 1000 + (40 - event.food.freshness) / 1200)),
  };
}

export function buildNutritionSnapshot(events: MealEvent[], now = new Date(), baseNutrition = 68, baseHydration = 76): NutritionSnapshot {
  const recent = events.filter((event) => now.getTime() - event.consumedAt.getTime() <= 72 * 36e5 && event.applied !== false);
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const meaningful = recent.filter((event) => event.food.satiety >= 40 || event.food.nutrition_value >= 45);
  const effects = recent.map((event, index) => calculateMealEffect(event, recent.slice(Math.max(0, index - 2), index)));
  const nutritionScore = clampWellness(baseNutrition - 10 + effects.reduce((sum, e) => sum + e.nutrition / 18, 0) - Math.max(0, FOOD_WELLNESS_BALANCE.dailyMeaningfulMealsExpected - meaningful.filter((e) => e.consumedAt >= todayStart).length) * 7);
  const hoursSinceStart = Math.max(1, (now.getTime() - todayStart.getTime()) / 36e5);
  const hydrationScore = clampWellness(baseHydration + effects.reduce((sum, e) => sum + e.hydration / 5, 0) - hoursSinceStart * FOOD_WELLNESS_BALANCE.hydrationDriftPerHour);
  const lastMeaningfulMealAt = meaningful.sort((a, b) => b.consumedAt.getTime() - a.consumedAt.getTime())[0]?.consumedAt ?? null;
  const mealTimingState = getMealTimingState(lastMeaningfulMealAt, now);
  const nutritionState = stateFromScore(nutritionScore, FOOD_WELLNESS_BALANCE.nutritionThresholds);
  const hydrationState = stateFromScore(hydrationScore, FOOD_WELLNESS_BALANCE.hydrationThresholds);
  const warning = hydrationScore < 50 ? "Rehydrate before demanding activity." : nutritionScore < 50 ? "Nutrition has been poor recently." : mealTimingState === "Hungry" || mealTimingState === "Very hungry" ? "Eat before the next major activity." : null;
  return { nutritionScore, hydrationScore, nutritionState, hydrationState, mealTimingState, lastMeaningfulMealAt, meaningfulMealsToday: meaningful.filter((e) => e.consumedAt >= todayStart).length, warning, suggestedAction: warning ?? "Maintain your current meal rhythm." };
}

export function getFoodRecoveryModifier(snapshot: Pick<NutritionSnapshot, "nutritionScore" | "hydrationScore">) {
  const average = (snapshot.nutritionScore + snapshot.hydrationScore) / 2;
  const raw = average >= 70 ? (average - 70) / 300 : -(70 - average) / 180;
  return Number(Math.max(FOOD_WELLNESS_BALANCE.recoveryModifierCaps.penalty, Math.min(FOOD_WELLNESS_BALANCE.recoveryModifierCaps.bonus, raw)).toFixed(3));
}

export function getFoodPerformanceModifier(snapshot: NutritionSnapshot, context: { activity: "gig" | "rehearsal" | "recording" | "practice" | "songwriting"; vocalist?: boolean; heavyMealWithinHour?: boolean }) {
  let mod = 0;
  if (snapshot.hydrationScore >= 80) mod += context.vocalist ? 0.025 : 0.01;
  if (snapshot.hydrationScore < 50) mod -= context.vocalist ? 0.08 : 0.05;
  if (["Hungry", "Very hungry"].includes(snapshot.mealTimingState)) mod -= snapshot.mealTimingState === "Very hungry" ? 0.07 : 0.035;
  if (snapshot.nutritionScore >= 75 && context.activity !== "songwriting") mod += 0.02;
  if (snapshot.nutritionScore < 45) mod -= context.activity === "songwriting" ? 0.015 : 0.04;
  if (context.heavyMealWithinHour) mod -= 0.025;
  const caps = FOOD_WELLNESS_BALANCE.performanceModifierCaps;
  return Number(Math.max(caps.penalty, Math.min(caps.bonus, mod)).toFixed(3));
}

export function isFoodUnlocked(food: FoodDefinition, fame = 0) {
  const order = ["new_artist", "active_musician", "professional_artist", "superstar"];
  return order.indexOf(getWellnessTier(fame)) >= order.indexOf(food.unlock_tier);
}

export function describeMealForPlayer(food: FoodDefinition) {
  const nutrition = food.nutrition_value >= 72 ? "High nutrition" : food.nutrition_value >= 50 ? "Balanced" : "Low nutrition";
  const energy = food.energy_value >= 8 || food.sugar_load >= 45 ? "Quick energy" : food.energy_value <= -2 ? "Energy dip" : "Steady energy";
  const hydration = food.hydration_value >= 20 ? "Strong hydration" : food.hydration_value >= 8 ? "Some hydration" : "Low hydration";
  const fullness = food.satiety >= 78 ? "Heavy" : food.satiety >= 45 ? "Filling" : "Light";
  const recommendedUse = food.category.includes("performance") ? "Recommended around performances" : food.recovery_support >= 10 ? "Good for recovery" : food.source_type === "hydration" ? "Hydration anytime" : "Everyday meal";
  return { nutrition, energy, hydration, fullness, recommendedUse };
}

export function chooseMealPlanOption(options: FoodDefinition[], plan: MealPlanType, fame = 0, availableFundsCents = Infinity) {
  const budget = Math.min(FOOD_WELLNESS_BALANCE.planBudgetsCents[plan], availableFundsCents);
  if (plan === "manual") return null;
  const unlocked = options.filter((f) => isFoodUnlocked(f, fame) && f.cost_cents <= budget && f.source_type !== "hydration");
  const scored = unlocked.map((food) => ({ food, score: food.nutrition_value + food.hydration_value * 0.4 + (plan === "recovery" ? food.recovery_support * 2 : 0) + (plan === "performance" ? (food.category === "pre_performance_meal" ? 20 : 0) : 0) + (plan === "luxury" ? food.meal_quality * 0.4 : 0) - food.cost_cents / 500 }));
  return scored.sort((a, b) => b.score - a.score)[0]?.food ?? options.find((f) => f.id === "free_water") ?? null;
}
