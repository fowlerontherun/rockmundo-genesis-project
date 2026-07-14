import { applyDailyWellnessDrift, buildCoreWellnessModifiers, calculateCanonicalReadiness, clampWellness, createDefaultWellnessCore, type WellnessCoreValues, type WellnessReadinessRole } from "./wellnessSystem";

export type WellnessSimulationScenario = "healthy_new_player" | "overworked_touring_player" | "veteran_performer" | "vocalist_high_strain" | "drummer_wrist_strain" | "poorly_rested_musician" | "burned_out_professional" | "low_income_free_recovery" | "premium_support_player" | "long_tour" | "returning_from_retirement" | "npc_artist" | "inactive_character";

export interface WellnessSimulationStep {
  day: number;
  activity: string;
  before: WellnessCoreValues;
  after: WellnessCoreValues;
  readiness: ReturnType<typeof calculateCanonicalReadiness>;
  warnings: string[];
}

export interface WellnessSimulationResult {
  scenario: WellnessSimulationScenario;
  seed: number;
  startingState: WellnessCoreValues;
  plannedActivities: string[];
  steps: WellnessSimulationStep[];
  finalState: WellnessCoreValues;
  capsApplied: string[];
  warningsTriggered: string[];
  productionMutation: false;
}

const scenarioDefaults: Record<WellnessSimulationScenario, Partial<WellnessCoreValues> & { activities: string[]; role: WellnessReadinessRole }> = {
  healthy_new_player: { activities: ["rest", "meal", "practice", "sleep", "first_gig"], role: "gig" },
  overworked_touring_player: { energy: 46, fatigue: 78, stress: 65, sleep_quality: 42, activities: ["travel", "gig", "travel", "gig", "rest_day"], role: "touring" },
  veteran_performer: { fitness: 78, motivation: 82, physical_health: 74, activities: ["rehearsal", "mentor", "gig"], role: "gig" },
  vocalist_high_strain: { physical_health: 62, fatigue: 66, activities: ["vocal_rest", "recording", "treatment"], role: "vocal" },
  drummer_wrist_strain: { physical_health: 64, fatigue: 70, activities: ["rehearsal", "rest", "gig"], role: "instrumental" },
  poorly_rested_musician: { energy: 35, sleep_quality: 24, fatigue: 72, activities: ["sleep", "meal", "practice"], role: "practice" },
  burned_out_professional: { stress: 88, burnout_risk: 86, motivation: 38, activities: ["career_break", "therapy", "return_plan"], role: "return_from_break" },
  low_income_free_recovery: { nutrition: 48, energy: 52, activities: ["free_water", "rest", "sleep"], role: "rehearsal" },
  premium_support_player: { fatigue: 62, stress: 58, activities: ["premium_hotel", "massage", "healthy_meal", "gig"], role: "gig" },
  long_tour: { fatigue: 68, stress: 61, sleep_quality: 50, activities: ["travel", "gig", "travel", "rest_day", "gig"], role: "touring" },
  returning_from_retirement: { motivation: 70, fitness: 49, activities: ["comeback_plan", "practice", "small_gig"], role: "comeback" },
  npc_artist: { energy: 70, fatigue: 48, nutrition: 62, activities: ["npc_gig", "npc_rest", "npc_meal"], role: "gig" },
  inactive_character: { energy: 55, fatigue: 58, sleep_quality: 55, activities: ["aggregate_recovery", "return_summary"], role: "practice" },
};

function seededVariance(seed: number, day: number) {
  const x = Math.sin(seed * 997 + day * 37) * 10000;
  return Math.round((x - Math.floor(x) - 0.5) * 4);
}

function applyActivity(values: WellnessCoreValues, activity: string, seed: number, day: number): WellnessCoreValues {
  const variance = seededVariance(seed, day);
  const next = { ...values };
  if (/gig|travel|rehearsal|recording/.test(activity)) {
    next.energy = clampWellness(next.energy - 8 + variance);
    next.fatigue = clampWellness(next.fatigue + 10 - variance);
    next.stress = clampWellness(next.stress + 4);
  }
  if (/rest|sleep|hotel|massage|break|therapy|aggregate_recovery/.test(activity)) {
    return applyDailyWellnessDrift({ ...next, stress: clampWellness(next.stress - 6), fatigue: clampWellness(next.fatigue - 8) }, 480);
  }
  if (/meal|water/.test(activity)) {
    next.nutrition = clampWellness(next.nutrition + 8);
    next.energy = clampWellness(next.energy + 4);
  }
  return next;
}

export function simulateWellnessScenario(scenario: WellnessSimulationScenario, seed = 1): WellnessSimulationResult {
  const config = scenarioDefaults[scenario];
  const startingState: WellnessCoreValues = { ...createDefaultWellnessCore(), ...config };
  let current = startingState;
  const steps = config.activities.map((activity, index) => {
    const before = current;
    const after = applyActivity(before, activity, seed, index + 1);
    current = after;
    const readiness = calculateCanonicalReadiness({ role: config.role, core: after, modifiers: buildCoreWellnessModifiers(after, config.role), confidence: "forecast" });
    const warnings = [readiness.explanation.suggestedAction].filter(Boolean);
    return { day: index + 1, activity, before, after, readiness, warnings };
  });
  return { scenario, seed, startingState, plannedActivities: config.activities, steps, finalState: current, capsApplied: steps.flatMap((s) => s.readiness.explanation.cappedContributors.map((c) => c.diagnosticId)), warningsTriggered: [...new Set(steps.flatMap((s) => s.warnings))], productionMutation: false };
}
