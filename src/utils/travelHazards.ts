import type { BehaviorSettings } from "@/hooks/useBehaviorSettings";
import { CONDITION_DEFINITIONS, type ConditionType } from "@/utils/conditionSystem";

const TRANSPORT_HAZARD_RATES: Record<string, number> = {
  bus: 0.04,
  train: 0.02,
  plane: 0.015,
  ship: 0.03,
  private_jet: 0.005,
  default: 0.02,
};

const TRAVEL_CONDITIONS = [
  "food_poisoning", "sprained_ankle", "back_strain", "severe_jetlag",
  "flu", "stomach_bug", "anxiety", "burnout", "depression",
];

export interface TravelHazardResult {
  triggered: boolean;
  conditionName: string | null;
  conditionType: ConditionType | null;
  severity: number;
}

export function rollForTravelHazard(
  transportMode: string,
  distanceKm: number,
  behaviorSettings?: Partial<BehaviorSettings>
): TravelHazardResult {
  const baseChance = TRANSPORT_HAZARD_RATES[transportMode] || TRANSPORT_HAZARD_RATES.default;

  // Long distance adds risk
  let chance = baseChance;
  if (distanceKm > 5000) chance += 0.02;
  else if (distanceKm > 2000) chance += 0.01;

  // Luxury travel reduces risk
  if (behaviorSettings?.travel_comfort === "luxury") chance *= 0.5;
  else if (behaviorSettings?.travel_comfort === "budget") chance *= 1.3;

  // Heavy partying increases risk
  if (behaviorSettings?.partying_intensity === "legendary") chance *= 1.4;
  else if (behaviorSettings?.partying_intensity === "heavy") chance *= 1.2;

  const triggered = Math.random() < chance;
  if (!triggered) return { triggered: false, conditionName: null, conditionType: null, severity: 0 };

  // Pick a random condition
  const conditionName = TRAVEL_CONDITIONS[Math.floor(Math.random() * TRAVEL_CONDITIONS.length)];
  const def = CONDITION_DEFINITIONS[conditionName];
  if (!def) return { triggered: false, conditionName: null, conditionType: null, severity: 0 };

  // Vary severity ±20%
  const severityVariance = 0.8 + Math.random() * 0.4;
  const severity = Math.max(10, Math.min(100, Math.round(def.defaultSeverity * severityVariance)));

  return { triggered: true, conditionName, conditionType: def.type, severity };
}
