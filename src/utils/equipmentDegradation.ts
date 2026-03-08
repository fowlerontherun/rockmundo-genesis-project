/**
 * Equipment Degradation System (v1.0.936)
 * Equipment wears down with use, affecting performance quality.
 * Different gear types degrade at different rates.
 * Maintenance and repair extend equipment life.
 */

export interface DegradationState {
  condition: number;         // 0-100 (100 = brand new)
  conditionLabel: "pristine" | "good" | "worn" | "damaged" | "broken";
  performanceModifier: number; // 0.5 – 1.0
  breakdownChance: number;     // 0 – 0.25 per gig
  repairCost: number;          // percentage of original price
  needsRepair: boolean;
}

// Degradation per gig by category
const DEGRADATION_RATES: Record<string, number> = {
  guitar: 1.5,
  bass: 1.2,
  drums: 2.5,     // Drums take the most beating
  keyboard: 0.8,
  microphone: 1.0,
  amplifier: 1.8,
  cables: 2.0,
  effects_pedal: 0.5,
  monitors: 1.0,
  lighting: 1.5,
  pa_system: 1.2,
  default: 1.0,
};

function getConditionLabel(condition: number): DegradationState["conditionLabel"] {
  if (condition >= 85) return "pristine";
  if (condition >= 65) return "good";
  if (condition >= 40) return "worn";
  if (condition >= 15) return "damaged";
  return "broken";
}

/**
 * Get equipment degradation state from current condition.
 */
export function getEquipmentCondition(condition: number): DegradationState {
  const clamped = Math.max(0, Math.min(100, condition));
  const label = getConditionLabel(clamped);
  const t = clamped / 100;

  return {
    condition: clamped,
    conditionLabel: label,
    performanceModifier: parseFloat((0.5 + t * 0.5).toFixed(2)),
    breakdownChance: parseFloat((0.25 * (1 - t) * (1 - t)).toFixed(3)), // quadratic increase
    repairCost: parseFloat(((1 - t) * 0.4).toFixed(2)), // up to 40% of original price
    needsRepair: clamped < 40,
  };
}

/**
 * Apply degradation from a gig to equipment.
 */
export function degradeEquipment(
  currentCondition: number,
  category: string,
  gigIntensity: number = 1.0 // 0.5 = acoustic set, 1.0 = normal, 1.5 = festival
): { newCondition: number; degradationAmount: number } {
  const rate = DEGRADATION_RATES[category.toLowerCase()] ?? DEGRADATION_RATES.default;
  const degradation = rate * gigIntensity * (0.8 + Math.random() * 0.4); // ±20% variance
  const newCondition = Math.max(0, currentCondition - degradation);
  return {
    newCondition: parseFloat(newCondition.toFixed(1)),
    degradationAmount: parseFloat(degradation.toFixed(1)),
  };
}

/**
 * Calculate repair cost.
 */
export function calculateRepairCost(
  currentCondition: number,
  originalPrice: number,
  targetCondition: number = 100
): { cost: number; timeHours: number } {
  const conditionGap = Math.max(0, targetCondition - currentCondition);
  const costRatio = (conditionGap / 100) * 0.4; // max 40% of original price for full repair
  const cost = Math.round(originalPrice * costRatio);
  const timeHours = Math.ceil(conditionGap / 20); // 5 hours for full repair
  return { cost, timeHours };
}

/**
 * Quality bonus from well-maintained equipment.
 */
export function getMaintenanceBonus(avgCondition: number): number {
  if (avgCondition >= 90) return 1.05;  // 5% bonus for pristine gear
  if (avgCondition >= 70) return 1.02;
  if (avgCondition >= 50) return 1.0;
  if (avgCondition >= 30) return 0.95;
  return 0.85; // significant penalty for broken gear
}
