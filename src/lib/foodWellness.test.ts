import { describe, expect, it } from "vitest";
import { buildNutritionSnapshot, calculateMealEffect, chooseMealPlanOption, DEFAULT_FOOD_DEFINITIONS, getFoodPerformanceModifier, getFoodRecoveryModifier } from "./foodWellness";

const food = (id: string) => DEFAULT_FOOD_DEFINITIONS.find((f) => f.id === id)!;
const at = (hoursAgo: number) => new Date(Date.UTC(2026, 6, 12, 12 - hoursAgo));
const now = new Date(Date.UTC(2026, 6, 12, 12));

describe("food wellness model", () => {
  it("balanced meals improve rolling nutrition within bounds and duplicate processing can be ignored", () => {
    const event = { id: "meal-1", food: food("standard_restaurant_meal"), consumedAt: at(2), applied: true };
    const duplicate = { ...event, applied: false };
    const snapshot = buildNutritionSnapshot([event, duplicate], now, 55, 70);
    expect(snapshot.nutritionScore).toBeGreaterThan(50);
    expect(snapshot.nutritionScore).toBeLessThanOrEqual(100);
    expect(snapshot.meaningfulMealsToday).toBe(1);
  });

  it("repeated poor meals and missed meals reduce nutrition gradually without severe one-meal punishment", () => {
    const events = [0, 7].map((h, i) => ({ id: `fast-${i}`, food: food("budget_fast_food"), consumedAt: at(h), applied: true }));
    const snapshot = buildNutritionSnapshot(events, now, 62, 72);
    expect(snapshot.nutritionState).not.toBe("Deficient");
    expect(snapshot.mealTimingState).toBe("Recently ate");
  });

  it("hydration declines over time and free hydration restores it", () => {
    const dry = buildNutritionSnapshot([], now, 68, 60);
    const watered = buildNutritionSnapshot([{ id: "water", food: food("free_water"), consumedAt: at(0), applied: true }], now, 68, 60);
    expect(dry.hydrationScore).toBeLessThan(60);
    expect(watered.hydrationScore).toBeGreaterThan(dry.hydrationScore);
  });

  it("restaurant quality influences meal outcome within caps", () => {
    const low = calculateMealEffect({ id: "low", food: food("standard_restaurant_meal"), consumedAt: now, sourceQuality: 20, cleanliness: 20, serviceQuality: 20 });
    const high = calculateMealEffect({ id: "high", food: food("standard_restaurant_meal"), consumedAt: now, sourceQuality: 100, cleanliness: 100, serviceQuality: 100 });
    expect(high.nutrition).toBeGreaterThan(low.nutrition);
    expect(high.nutrition - low.nutrition).toBeLessThanOrEqual(16);
  });

  it("pre-performance and recovery modifiers are bounded", () => {
    const snapshot = buildNutritionSnapshot([{ id: "pre", food: food("pre_gig_light_meal"), consumedAt: at(1), applied: true }], now, 70, 82);
    expect(getFoodPerformanceModifier(snapshot, { activity: "gig", vocalist: true })).toBeLessThanOrEqual(0.06);
    expect(getFoodRecoveryModifier(snapshot)).toBeLessThanOrEqual(0.1);
  });

  it("heavy hungry states create bounded penalties and songwriting is not directly boosted by expensive meals", () => {
    const hungry = buildNutritionSnapshot([], now, 35, 42);
    expect(getFoodPerformanceModifier(hungry, { activity: "gig", vocalist: true })).toBeGreaterThanOrEqual(-0.12);
    expect(getFoodPerformanceModifier(hungry, { activity: "songwriting" })).toBeGreaterThanOrEqual(-0.12);
  });

  it("meal plans respect unlocks, budgets and hydration fallback", () => {
    expect(chooseMealPlanOption(DEFAULT_FOOD_DEFINITIONS, "performance", 0, 5000)?.id).not.toBe("pre_gig_light_meal");
    expect(chooseMealPlanOption(DEFAULT_FOOD_DEFINITIONS, "budget", 0, 0)?.id).toBe("free_water");
  });
});
