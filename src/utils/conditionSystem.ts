export type ConditionType = "injury" | "sickness" | "mental_health";
export type ConditionStatus = "active" | "treating" | "recovered";
export type TreatmentType = "hospital" | "therapy" | "medication" | "rest";

export interface ConditionEffects {
  health_drain?: number;       // per hour
  energy_cap?: number;         // max energy %
  xp_penalty?: number;         // % reduction
  blocks_gigs?: boolean;
  blocks_guitar_gigs?: boolean;
  blocks_singing?: boolean;
  blocks_travel?: boolean;
  gig_score_penalty?: number;
  fan_interaction_penalty?: number;
  rest_effectiveness?: number; // % modifier (negative = worse)
  health_recovery?: number;    // % modifier
  songwriting_quality?: number; // % modifier (can be positive!)
}

export interface ConditionDefinition {
  name: string;
  label: string;
  type: ConditionType;
  icon: string;
  defaultSeverity: number;
  effects: ConditionEffects;
  treatmentOptions: TreatmentType[];
  recoveryDays: { min: number; max: number };
  treatmentCosts: Partial<Record<TreatmentType, number>>;
  description: string;
}

export const CONDITION_DEFINITIONS: Record<string, ConditionDefinition> = {
  // === INJURIES ===
  sprained_wrist: {
    name: "sprained_wrist", label: "Sprained Wrist", type: "injury", icon: "🦴",
    defaultSeverity: 45, description: "A painful wrist sprain limiting instrument play.",
    effects: { blocks_guitar_gigs: true, xp_penalty: 15, energy_cap: 80 },
    treatmentOptions: ["hospital", "rest"],
    recoveryDays: { min: 3, max: 7 },
    treatmentCosts: { hospital: 200 },
  },
  sprained_ankle: {
    name: "sprained_ankle", label: "Sprained Ankle", type: "injury", icon: "🦴",
    defaultSeverity: 40, description: "Twisted ankle making it hard to perform on stage.",
    effects: { xp_penalty: 10, energy_cap: 70, gig_score_penalty: 15 },
    treatmentOptions: ["hospital", "rest"],
    recoveryDays: { min: 3, max: 7 },
    treatmentCosts: { hospital: 150 },
  },
  back_strain: {
    name: "back_strain", label: "Back Strain", type: "injury", icon: "🦴",
    defaultSeverity: 55, description: "Severe back pain from heavy lifting.",
    effects: { energy_cap: 60, xp_penalty: 10 },
    treatmentOptions: ["hospital", "rest"],
    recoveryDays: { min: 5, max: 10 },
    treatmentCosts: { hospital: 250 },
  },
  bruised_ribs: {
    name: "bruised_ribs", label: "Bruised Ribs", type: "injury", icon: "🦴",
    defaultSeverity: 50, description: "Painful bruised ribs making breathing difficult.",
    effects: { xp_penalty: 15, energy_cap: 65, gig_score_penalty: 20 },
    treatmentOptions: ["hospital", "rest"],
    recoveryDays: { min: 5, max: 10 },
    treatmentCosts: { hospital: 200 },
  },
  vocal_strain: {
    name: "vocal_strain", label: "Vocal Strain", type: "injury", icon: "🎤",
    defaultSeverity: 45, description: "Damaged vocal cords. Singing is out of the question.",
    effects: { blocks_singing: true, xp_penalty: 20 },
    treatmentOptions: ["hospital", "rest"],
    recoveryDays: { min: 2, max: 5 },
    treatmentCosts: { hospital: 180 },
  },
  concussion: {
    name: "concussion", label: "Concussion", type: "injury", icon: "🤕",
    defaultSeverity: 70, description: "Head injury requiring complete rest.",
    effects: { blocks_gigs: true, xp_penalty: 30, energy_cap: 50 },
    treatmentOptions: ["hospital", "rest"],
    recoveryDays: { min: 7, max: 14 },
    treatmentCosts: { hospital: 500 },
  },
  hand_fracture: {
    name: "hand_fracture", label: "Hand Fracture", type: "injury", icon: "🦴",
    defaultSeverity: 75, description: "Fractured hand. Can't play instruments.",
    effects: { blocks_guitar_gigs: true, xp_penalty: 25, energy_cap: 70 },
    treatmentOptions: ["hospital"],
    recoveryDays: { min: 14, max: 28 },
    treatmentCosts: { hospital: 800 },
  },

  // === SICKNESSES ===
  flu: {
    name: "flu", label: "Flu", type: "sickness", icon: "🤒",
    defaultSeverity: 40, description: "A nasty flu sapping your energy.",
    effects: { health_drain: 3, energy_cap: 50 },
    treatmentOptions: ["hospital", "medication", "rest"],
    recoveryDays: { min: 2, max: 4 },
    treatmentCosts: { hospital: 100, medication: 30 },
  },
  food_poisoning: {
    name: "food_poisoning", label: "Food Poisoning", type: "sickness", icon: "🤮",
    defaultSeverity: 55, description: "Severe food poisoning. You can barely stand.",
    effects: { health_drain: 5, energy_cap: 30 },
    treatmentOptions: ["hospital", "medication", "rest"],
    recoveryDays: { min: 1, max: 2 },
    treatmentCosts: { hospital: 150, medication: 40 },
  },
  tropical_fever: {
    name: "tropical_fever", label: "Tropical Fever", type: "sickness", icon: "🌡️",
    defaultSeverity: 65, description: "A dangerous tropical illness. Travel is inadvisable.",
    effects: { health_drain: 4, blocks_travel: true, energy_cap: 40 },
    treatmentOptions: ["hospital", "medication", "rest"],
    recoveryDays: { min: 5, max: 10 },
    treatmentCosts: { hospital: 400, medication: 80 },
  },
  severe_jetlag: {
    name: "severe_jetlag", label: "Severe Jet Lag", type: "sickness", icon: "✈️",
    defaultSeverity: 35, description: "Your body clock is completely out of sync.",
    effects: { energy_cap: 60, xp_penalty: 10, rest_effectiveness: -30 },
    treatmentOptions: ["medication", "rest"],
    recoveryDays: { min: 1, max: 3 },
    treatmentCosts: { medication: 30 },
  },
  cold: {
    name: "cold", label: "Common Cold", type: "sickness", icon: "🤧",
    defaultSeverity: 25, description: "A mild cold. Annoying but manageable.",
    effects: { health_drain: 1, energy_cap: 80, xp_penalty: 5 },
    treatmentOptions: ["medication", "rest"],
    recoveryDays: { min: 2, max: 4 },
    treatmentCosts: { medication: 15 },
  },
  stomach_bug: {
    name: "stomach_bug", label: "Stomach Bug", type: "sickness", icon: "🤢",
    defaultSeverity: 35, description: "An unpleasant stomach virus.",
    effects: { health_drain: 2, energy_cap: 60 },
    treatmentOptions: ["medication", "rest"],
    recoveryDays: { min: 1, max: 3 },
    treatmentCosts: { medication: 20 },
  },

  // === MENTAL HEALTH ===
  depression: {
    name: "depression", label: "Depression", type: "mental_health", icon: "🧠",
    defaultSeverity: 50, description: "A dark cloud hanging over everything. But pain can fuel art.",
    effects: { xp_penalty: 20, songwriting_quality: 10, energy_cap: 60 },
    treatmentOptions: ["therapy", "medication", "rest"],
    recoveryDays: { min: 7, max: 21 },
    treatmentCosts: { therapy: 100, medication: 50 },
  },
  anxiety: {
    name: "anxiety", label: "Anxiety", type: "mental_health", icon: "😰",
    defaultSeverity: 45, description: "Constant dread and trembling. Performing feels impossible.",
    effects: { gig_score_penalty: 15, fan_interaction_penalty: 20, xp_penalty: 10 },
    treatmentOptions: ["therapy", "medication", "rest"],
    recoveryDays: { min: 5, max: 14 },
    treatmentCosts: { therapy: 80, medication: 40 },
  },
  burnout: {
    name: "burnout", label: "Burnout", type: "mental_health", icon: "🔥",
    defaultSeverity: 60, description: "Complete exhaustion. You need to stop everything and rest.",
    effects: { blocks_gigs: true, xp_penalty: 25, energy_cap: 40 },
    treatmentOptions: ["therapy", "rest"],
    recoveryDays: { min: 7, max: 14 },
    treatmentCosts: { therapy: 150 },
  },
  insomnia: {
    name: "insomnia", label: "Insomnia", type: "mental_health", icon: "😵‍💫",
    defaultSeverity: 40, description: "Can't sleep. Rest is barely effective.",
    effects: { rest_effectiveness: -50, energy_cap: 70, health_recovery: -30 },
    treatmentOptions: ["therapy", "medication", "rest"],
    recoveryDays: { min: 3, max: 10 },
    treatmentCosts: { therapy: 80, medication: 35 },
  },
};

/** Get condition definition by name */
export function getConditionDefinition(conditionName: string): ConditionDefinition | undefined {
  return CONDITION_DEFINITIONS[conditionName];
}

/** Calculate recovery time in hours based on severity and treatment */
export function calculateRecoveryTime(
  conditionName: string,
  severity: number,
  treatmentType: TreatmentType
): number {
  const def = CONDITION_DEFINITIONS[conditionName];
  if (!def) return 72; // default 3 days

  const baseDays = def.recoveryDays.min + (def.recoveryDays.max - def.recoveryDays.min) * (severity / 100);

  const treatmentMultiplier: Record<TreatmentType, number> = {
    hospital: 0.4,   // 60% faster
    therapy: 0.6,    // 40% faster (mental health)
    medication: 0.7, // 30% faster
    rest: 1.0,       // normal speed
  };

  return Math.round(baseDays * (treatmentMultiplier[treatmentType] || 1) * 24);
}

/** Aggregate effects from multiple active conditions */
export function aggregateConditionEffects(
  conditions: Array<{ condition_name: string; severity: number; effects: ConditionEffects | null }>
): ConditionEffects {
  const result: ConditionEffects = {};

  for (const condition of conditions) {
    const effects = condition.effects || CONDITION_DEFINITIONS[condition.condition_name]?.effects || {};
    const severityMultiplier = condition.severity / 100;

    // Boolean effects — any true wins
    if (effects.blocks_gigs) result.blocks_gigs = true;
    if (effects.blocks_guitar_gigs) result.blocks_guitar_gigs = true;
    if (effects.blocks_singing) result.blocks_singing = true;
    if (effects.blocks_travel) result.blocks_travel = true;

    // Numeric penalties stack (capped)
    result.xp_penalty = Math.min(50, (result.xp_penalty || 0) + (effects.xp_penalty || 0) * severityMultiplier);
    result.health_drain = (result.health_drain || 0) + (effects.health_drain || 0) * severityMultiplier;
    result.gig_score_penalty = Math.min(50, (result.gig_score_penalty || 0) + (effects.gig_score_penalty || 0) * severityMultiplier);
    result.fan_interaction_penalty = Math.min(50, (result.fan_interaction_penalty || 0) + (effects.fan_interaction_penalty || 0) * severityMultiplier);

    // Energy cap takes the lowest
    if (effects.energy_cap != null) {
      result.energy_cap = Math.min(result.energy_cap ?? 100, effects.energy_cap);
    }

    // Rest/recovery modifiers stack
    result.rest_effectiveness = (result.rest_effectiveness || 0) + (effects.rest_effectiveness || 0);
    result.health_recovery = (result.health_recovery || 0) + (effects.health_recovery || 0);

    // Songwriting quality can be positive (depression boost)
    result.songwriting_quality = (result.songwriting_quality || 0) + (effects.songwriting_quality || 0);
  }

  return result;
}

/** Get icon + color for condition type */
export function getConditionTypeInfo(type: ConditionType): { icon: string; color: string; label: string } {
  switch (type) {
    case "injury": return { icon: "🦴", color: "text-orange-500", label: "Injury" };
    case "sickness": return { icon: "🤒", color: "text-red-500", label: "Sickness" };
    case "mental_health": return { icon: "🧠", color: "text-purple-500", label: "Mental Health" };
  }
}

/** Get severity label */
export function getConditionSeverityLabel(severity: number): { label: string; color: string } {
  if (severity <= 25) return { label: "Mild", color: "text-yellow-500" };
  if (severity <= 50) return { label: "Moderate", color: "text-orange-400" };
  if (severity <= 75) return { label: "Serious", color: "text-orange-600" };
  return { label: "Severe", color: "text-red-600" };
}
