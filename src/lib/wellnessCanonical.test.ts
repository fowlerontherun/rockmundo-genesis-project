import { describe, expect, it } from "vitest";
import { buildCoreWellnessModifiers, calculateCanonicalReadiness, normalizeWellnessModifiers, type WellnessModifier } from "./wellnessSystem";
import { simulateWellnessScenario } from "./wellnessSimulation";

const mod = (id: string, value: number, group = id): WellnessModifier => ({ id, source: "test", category: "professional_support", target: "gig", rawValue: value, stackingGroup: group, priority: 1, mode: "additive", mayStack: false, explanation: id, diagnosticId: id });

describe("canonical wellness pipeline", () => {
  it("deduplicates stable modifier ids and stacking groups", () => {
    const normalized = normalizeWellnessModifiers([mod("a", 0.05, "support"), mod("a", 0.05, "support"), mod("b", 0.08, "support")]);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].id).toBe("b");
  });

  it("caps stacked positive and negative readiness impact", () => {
    const positive = calculateCanonicalReadiness({ role: "gig", core: { energy: 100, fatigue: 0, sleep_quality: 100 }, modifiers: [mod("p1", 0.12), mod("p2", 0.12, "p2")] });
    expect(positive.performanceModifier).toBeLessThanOrEqual(1.12);
    const negative = calculateCanonicalReadiness({ role: "gig", core: { energy: 30, fatigue: 90 }, modifiers: [mod("n1", -0.2), mod("n2", -0.2, "n2")] });
    expect(negative.performanceModifier).toBeGreaterThanOrEqual(0.75);
  });

  it("keeps role restrictions role-specific", () => {
    expect(calculateCanonicalReadiness({ role: "vocal", restrictions: ["voice_loss"] }).state).toBe("unavailable");
    expect(calculateCanonicalReadiness({ role: "songwriting", restrictions: ["voice_loss"] }).state).not.toBe("unavailable");
  });

  it("generates player-facing explanations from server-side modifiers", () => {
    const readiness = calculateCanonicalReadiness({ role: "gig", core: { energy: 85, sleep_quality: 82 }, modifiers: buildCoreWellnessModifiers({ energy: 85, sleep_quality: 82 }, "gig") });
    expect(readiness.explanation.summary).toContain("gig readiness");
    expect(readiness.explanation.positiveContributors.length).toBeGreaterThan(0);
  });
});

describe("wellness balance simulations", () => {
  it("keeps healthy new players viable through first activities", () => {
    const result = simulateWellnessScenario("healthy_new_player", 42);
    expect(result.productionMutation).toBe(false);
    expect(result.steps.at(-1)?.readiness.score).toBeGreaterThanOrEqual(50);
  });

  it("makes long tours visible but not automatically impossible", () => {
    const result = simulateWellnessScenario("long_tour", 7);
    const final = result.steps.at(-1)!.readiness;
    expect(final.score).toBeGreaterThanOrEqual(30);
    expect(final.score).toBeLessThan(90);
  });
});
