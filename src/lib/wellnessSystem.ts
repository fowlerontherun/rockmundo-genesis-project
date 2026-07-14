export type WellnessTierKey = "new_artist" | "active_musician" | "professional_artist" | "superstar";
export type WellnessState = "Excellent" | "Good" | "Stable" | "Struggling" | "Critical";
export type WellnessStatKey = "overall_wellness" | "energy" | "physical_health" | "happiness" | "stress" | "fatigue" | "sleep_quality" | "nutrition" | "fitness" | "motivation" | "burnout_risk";

export interface WellnessCoreValues {
  energy: number;
  physical_health: number;
  happiness: number;
  stress: number;
  fatigue: number;
  sleep_quality: number;
  nutrition: number;
  fitness: number;
  motivation: number;
  burnout_risk: number;
}

export interface WellnessActivityBalance {
  slug: string;
  name: string;
  duration_minutes: number;
  cost_cents: number;
  unlock_tier: WellnessTierKey;
  cooldown_hours: number;
  can_overlap: boolean;
  stat_effects: Partial<WellnessCoreValues>;
  location_tags: string[];
  gameplay_impact: string;
}

export const WELLNESS_BALANCE = {
  thresholds: [
    { state: "Excellent" as const, min: 85 },
    { state: "Good" as const, min: 70 },
    { state: "Stable" as const, min: 50 },
    { state: "Struggling" as const, min: 30 },
    { state: "Critical" as const, min: 0 },
  ],
  tiers: [
    { key: "new_artist" as const, label: "New Artist", minFame: 0, stats: ["overall_wellness", "energy", "physical_health", "happiness", "sleep_quality"] as WellnessStatKey[], description: "Core wellbeing, rest, meals and basic recovery." },
    { key: "active_musician" as const, label: "Active Musician", minFame: 100, stats: ["stress", "fatigue", "nutrition", "fitness"] as WellnessStatKey[], description: "Training load, touring pressure, food quality and recovery services." },
    { key: "professional_artist" as const, label: "Professional Artist", minFame: 1000, stats: ["motivation", "burnout_risk"] as WellnessStatKey[], description: "Motivation, burnout management, accommodation recovery hooks and studio prep." },
    { key: "superstar" as const, label: "Superstar", minFame: 10000, stats: [] as WellnessStatKey[], description: "Premium recovery, luxury travel/accommodation hooks and staff hooks." },
  ],
  weights: {
    energy: 0.16,
    physical_health: 0.18,
    happiness: 0.12,
    sleep_quality: 0.13,
    nutrition: 0.1,
    fitness: 0.09,
    motivation: 0.1,
    stress: -0.05,
    fatigue: -0.04,
    burnout_risk: -0.03,
  },
  performance: { maxBonus: 1.08, maxPenalty: 0.8, criticalPenalty: 0.65 },
  dailyDrift: { energy: 3, fatigue: -4, nutrition: -3, stress: 1, sleep_quality: -2, motivation: -1 },
  conditionRecoveryPerDay: { base: 18, restedBonus: 8, treatmentBonus: 16 },
} as const;

export const WELLNESS_ACTIVITIES: WellnessActivityBalance[] = [
  { slug: "rest", name: "Rest", duration_minutes: 60, cost_cents: 0, unlock_tier: "new_artist", cooldown_hours: 2, can_overlap: false, stat_effects: { fatigue: -10, energy: 6, stress: -4 }, location_tags: ["home", "hotel"], gameplay_impact: "Reduces fatigue before practice, gigs and travel." },
  { slug: "sleep", name: "Sleep", duration_minutes: 480, cost_cents: 0, unlock_tier: "new_artist", cooldown_hours: 16, can_overlap: false, stat_effects: { energy: 28, sleep_quality: 18, fatigue: -24, stress: -5 }, location_tags: ["home", "hotel"], gameplay_impact: "Best recovery for energy, fatigue and illness progress." },
  { slug: "power_nap", name: "Power nap", duration_minutes: 25, cost_cents: 0, unlock_tier: "new_artist", cooldown_hours: 8, can_overlap: false, stat_effects: { energy: 10, fatigue: -5 }, location_tags: ["home", "studio", "venue"], gameplay_impact: "Short energy recovery with limited daily value." },
  { slug: "healthy_meal", name: "Healthy meal", duration_minutes: 45, cost_cents: 1800, unlock_tier: "new_artist", cooldown_hours: 4, can_overlap: false, stat_effects: { nutrition: 14, energy: 4, happiness: 2 }, location_tags: ["restaurant", "home"], gameplay_impact: "Improves nutrition and avoids poorly-fed penalties." },
  { slug: "relaxation", name: "Relaxation", duration_minutes: 45, cost_cents: 0, unlock_tier: "new_artist", cooldown_hours: 3, can_overlap: false, stat_effects: { stress: -12, happiness: 6, motivation: 2 }, location_tags: ["home", "park"], gameplay_impact: "Lowers stress and improves mood before demanding work." },
  { slug: "exercise", name: "Exercise", duration_minutes: 60, cost_cents: 0, unlock_tier: "active_musician", cooldown_hours: 12, can_overlap: false, stat_effects: { energy: -8, fitness: 8, stress: -8, fatigue: 6, physical_health: 3 }, location_tags: ["gym", "park"], gameplay_impact: "Builds fitness but adds fatigue if overused." },
  { slug: "massage", name: "Massage", duration_minutes: 60, cost_cents: 6500, unlock_tier: "active_musician", cooldown_hours: 24, can_overlap: false, stat_effects: { fatigue: -16, physical_health: 5, stress: -5 }, location_tags: ["wellness_center", "hotel"], gameplay_impact: "Paid fatigue recovery for rehearsals, tours and long studio days." },
  { slug: "doctor_visit", name: "Doctor visit", duration_minutes: 90, cost_cents: 12000, unlock_tier: "new_artist", cooldown_hours: 24, can_overlap: false, stat_effects: { physical_health: 8, fatigue: -4 }, location_tags: ["hospital", "clinic"], gameplay_impact: "Treats minor conditions; recovery still depends on time and rest." },
];

export const clampWellness = (value: number) => Math.round(Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)));

export function calculateOverallWellness(values: WellnessCoreValues): number {
  const weighted = Object.entries(WELLNESS_BALANCE.weights).reduce((sum, [key, weight]) => {
    const raw = clampWellness(values[key as keyof WellnessCoreValues]);
    return sum + (weight < 0 ? (100 - raw) * Math.abs(weight) : raw * weight);
  }, 0);
  const totalWeight = Object.values(WELLNESS_BALANCE.weights).reduce((sum, weight) => sum + Math.abs(weight), 0);
  return clampWellness(weighted / totalWeight);
}

export function getWellnessState(score: number): WellnessState {
  return WELLNESS_BALANCE.thresholds.find((band) => score >= band.min)?.state ?? "Critical";
}

export function getWellnessTier(fame = 0): WellnessTierKey {
  return [...WELLNESS_BALANCE.tiers].reverse().find((tier) => fame >= tier.minFame)?.key ?? "new_artist";
}

export function isWellnessStatUnlocked(stat: WellnessStatKey, fame = 0): boolean {
  const tierIndex = WELLNESS_BALANCE.tiers.findIndex((tier) => tier.key === getWellnessTier(fame));
  return WELLNESS_BALANCE.tiers.slice(0, tierIndex + 1).some((tier) => (tier.stats as readonly WellnessStatKey[]).includes(stat));
}

export function isWellnessActivityUnlocked(slug: string, fame = 0): boolean {
  const activity = WELLNESS_ACTIVITIES.find((item) => item.slug === slug);
  if (!activity) return false;
  const required = WELLNESS_BALANCE.tiers.findIndex((tier) => tier.key === activity.unlock_tier);
  const current = WELLNESS_BALANCE.tiers.findIndex((tier) => tier.key === getWellnessTier(fame));
  return current >= required;
}

export function getWellnessWarnings(values: WellnessCoreValues) {
  const overall = calculateOverallWellness(values);
  const warnings: { key: string; label: string; impact: string; action: string; severity: number }[] = [];
  if (overall < 30) warnings.push({ key: "critical", label: "Critical wellness", impact: "Demanding gigs, sessions and travel may be blocked.", action: "Sleep or visit a doctor before booking more work.", severity: 5 });
  if (values.energy < 25) warnings.push({ key: "low_energy", label: "Low energy", impact: "Lower stage energy, studio consistency and practice gains.", action: "Sleep, rest or take a power nap.", severity: 3 });
  if (values.stress > 75) warnings.push({ key: "high_stress", label: "High stress", impact: "Higher mistake risk and burnout pressure.", action: "Use relaxation or massage.", severity: 3 });
  if (values.fatigue > 80) warnings.push({ key: "severe_fatigue", label: "Severe fatigue", impact: "Reduced stamina across long setlists, tours and rehearsals.", action: "Prioritise sleep or rest.", severity: 4 });
  if (values.sleep_quality < 30) warnings.push({ key: "poor_sleep", label: "Poor sleep", impact: "Slower condition recovery and weaker energy regeneration.", action: "Schedule a full sleep block.", severity: 2 });
  if (values.burnout_risk > 70) warnings.push({ key: "burnout", label: "Burnout risk", impact: "Long-term motivation and availability are at risk.", action: "Reduce workload and book recovery.", severity: 4 });
  return warnings.sort((a, b) => b.severity - a.severity);
}

export function getPerformanceModifier(values?: Partial<WellnessCoreValues> | null): number {
  if (!values) return 1;
  const defaults = createDefaultWellnessCore();
  const score = calculateOverallWellness({ ...defaults, ...values });
  if (score < 30) return WELLNESS_BALANCE.performance.criticalPenalty;
  const centered = (score - 50) / 50;
  const raw = centered >= 0 ? 1 + centered * (WELLNESS_BALANCE.performance.maxBonus - 1) : 1 + centered * (1 - WELLNESS_BALANCE.performance.maxPenalty);
  return Number(Math.max(WELLNESS_BALANCE.performance.maxPenalty, Math.min(WELLNESS_BALANCE.performance.maxBonus, raw)).toFixed(3));
}

export function createDefaultWellnessCore(existing?: Partial<{ health: number; energy: number; mood: number; stress: number }>): WellnessCoreValues {
  const energy = clampWellness(existing?.energy ?? 80);
  const physical_health = clampWellness(existing?.health ?? 80);
  const happiness = clampWellness(existing?.mood ?? 72);
  const stress = clampWellness(existing?.stress ?? 28);
  return { energy, physical_health, happiness, stress, fatigue: clampWellness(35 + Math.max(0, 50 - energy) / 2), sleep_quality: 72, nutrition: 68, fitness: 55, motivation: happiness, burnout_risk: clampWellness(stress * 0.45 + Math.max(0, 60 - happiness) * 0.35) };
}

export interface WellnessScheduleWindow {
  startsAt: Date;
  endsAt: Date;
  canOverlap?: boolean;
  existing?: Array<{ startsAt: Date; endsAt: Date; status?: string }>;
  now?: Date;
}

export function validateWellnessScheduleWindow({ startsAt, endsAt, canOverlap = false, existing = [], now = new Date() }: WellnessScheduleWindow): { ok: true } | { ok: false; reason: "past" | "invalid_duration" | "overlap" } {
  if (startsAt < now) return { ok: false, reason: "past" };
  if (endsAt <= startsAt) return { ok: false, reason: "invalid_duration" };
  if (!canOverlap) {
    const overlaps = existing.some((activity) => {
      if (activity.status && !["scheduled", "in_progress"].includes(activity.status)) return false;
      return activity.startsAt < endsAt && activity.endsAt > startsAt;
    });
    if (overlaps) return { ok: false, reason: "overlap" };
  }
  return { ok: true };
}

export function applyDailyWellnessDrift(values: WellnessCoreValues, sleptMinutes = 0): WellnessCoreValues {
  const sleptWell = sleptMinutes >= 420;
  return {
    ...values,
    energy: clampWellness(values.energy + WELLNESS_BALANCE.dailyDrift.energy + (sleptWell ? 14 : -5)),
    fatigue: clampWellness(values.fatigue + WELLNESS_BALANCE.dailyDrift.fatigue + (sleptWell ? -10 : 8)),
    nutrition: clampWellness(values.nutrition + WELLNESS_BALANCE.dailyDrift.nutrition),
    stress: clampWellness(values.stress + WELLNESS_BALANCE.dailyDrift.stress + (sleptWell ? -2 : 3)),
    sleep_quality: clampWellness(values.sleep_quality + WELLNESS_BALANCE.dailyDrift.sleep_quality + (sleptWell ? 10 : -10)),
    motivation: clampWellness(values.motivation + WELLNESS_BALANCE.dailyDrift.motivation + (values.happiness > 70 ? 2 : -1)),
    burnout_risk: clampWellness(values.burnout_risk + (values.stress > 70 ? 5 : -3) + (values.fatigue > 75 ? 4 : 0)),
  };
}

export type WellnessModifierCategory = "core" | "strain" | "condition" | "energy" | "sleep" | "nutrition" | "burnout" | "lifestyle" | "travel" | "professional_support" | "career" | "preparation" | "facility" | "safety_cap";
export type WellnessModifierMode = "additive" | "multiplicative";
export type WellnessReadinessRole = "gig" | "vocal" | "instrumental" | "rehearsal" | "practice" | "recording" | "songwriting" | "touring" | "travel" | "professional_service" | "mentoring" | "return_from_break" | "comeback";
export type WellnessReadinessState = "fully_ready" | "ready" | "minor_concerns" | "reduced_readiness" | "high_risk" | "restricted" | "unavailable";

export interface WellnessModifier {
  id: string;
  source: string;
  category: WellnessModifierCategory;
  target: WellnessReadinessRole | "performance" | "recovery" | "progression" | "career_sustainability" | "burnout_pressure";
  rawValue: number;
  cappedValue?: number;
  stackingGroup: string;
  priority: number;
  duration?: { startsAt?: string; endsAt?: string };
  mode: WellnessModifierMode;
  mayStack: boolean;
  explanation: string;
  diagnosticId: string;
}

export interface WellnessExplanation {
  finalResult: number;
  baseValue: number;
  positiveContributors: WellnessModifier[];
  negativeContributors: WellnessModifier[];
  cappedContributors: WellnessModifier[];
  ignoredContributors: WellnessModifier[];
  appliedRestriction?: string;
  suggestedAction: string;
  confidence: "actual" | "forecast" | "partial";
  summary: string;
}

export interface WellnessReadinessResult {
  role: WellnessReadinessRole;
  score: number;
  state: WellnessReadinessState;
  performanceModifier: number;
  risk: number;
  explanation: WellnessExplanation;
}

export const WELLNESS_PIPELINE_ORDER: WellnessModifierCategory[] = [
  "core", "strain", "condition", "energy", "sleep", "nutrition", "burnout", "lifestyle", "travel", "professional_support", "career", "preparation", "facility", "safety_cap",
];

export const WELLNESS_CANONICAL_BALANCE = {
  version: "wellness-consolidation-v1",
  effectiveDate: "2026-07-12",
  description: "Canonical modifier, readiness and explanation caps for the consolidated Wellness ecosystem.",
  globalModifierCaps: { positive: 0.12, negative: -0.25, severeNegative: -0.4 },
  readinessCaps: { min: 0, max: 100, ordinaryPenaltyFloor: 25, ordinaryBonusCeiling: 15 },
  readinessThresholds: [
    { state: "fully_ready" as const, min: 90 },
    { state: "ready" as const, min: 78 },
    { state: "minor_concerns" as const, min: 64 },
    { state: "reduced_readiness" as const, min: 48 },
    { state: "high_risk" as const, min: 30 },
    { state: "restricted" as const, min: 1 },
    { state: "unavailable" as const, min: 0 },
  ],
  roleRestrictions: {
    vocal: ["voice_loss", "severe_throat_condition"],
    instrumental: ["severe_wrist_condition", "severe_hand_condition"],
    travel: ["travel_locked"],
    comeback: ["retirement_cooldown"],
  } as Partial<Record<WellnessReadinessRole, string[]>>,
  changedValues: ["globalModifierCaps", "readinessThresholds", "pipelineOrder"],
  appliesTo: "new calculations only; historical outcomes require explicit recalculation",
  rollback: { previousVersion: "wellness-foundation", requiresRecalculation: false },
} as const;

const readinessAction = (role: WellnessReadinessRole, score: number) => {
  if (score >= 78) return `Maintain current recovery before ${role.split("_").join(" ")}.`;
  if (score >= 48) return "Add rest, food, hydration or lighter preparation before committing.";
  return "Delay demanding activity or use recovery support before proceeding.";
};

export function normalizeWellnessModifiers(modifiers: WellnessModifier[]): WellnessModifier[] {
  const seen = new Set<string>();
  const byGroup = new Map<string, WellnessModifier>();
  const sorted = [...modifiers].sort((a, b) => WELLNESS_PIPELINE_ORDER.indexOf(a.category) - WELLNESS_PIPELINE_ORDER.indexOf(b.category) || b.priority - a.priority || a.id.localeCompare(b.id));
  const normalized: WellnessModifier[] = [];
  for (const modifier of sorted) {
    if (seen.has(modifier.id)) continue;
    seen.add(modifier.id);
    const value = Number.isFinite(modifier.rawValue) ? modifier.rawValue : 0;
    const cappedValue = Number(Math.max(WELLNESS_CANONICAL_BALANCE.globalModifierCaps.negative, Math.min(WELLNESS_CANONICAL_BALANCE.globalModifierCaps.positive, value)).toFixed(4));
    const withCap = { ...modifier, cappedValue };
    if (!modifier.mayStack && byGroup.has(modifier.stackingGroup)) {
      const existing = byGroup.get(modifier.stackingGroup)!;
      if (Math.abs(cappedValue) > Math.abs(existing.cappedValue ?? existing.rawValue)) {
        const index = normalized.findIndex((item) => item.id === existing.id);
        normalized[index] = withCap;
        byGroup.set(modifier.stackingGroup, withCap);
      }
      continue;
    }
    normalized.push(withCap);
    if (!modifier.mayStack) byGroup.set(modifier.stackingGroup, withCap);
  }
  return normalized;
}

export function calculateCanonicalReadiness(input: { role: WellnessReadinessRole; core?: Partial<WellnessCoreValues>; baseValue?: number; modifiers?: WellnessModifier[]; restrictions?: string[]; confidence?: WellnessExplanation["confidence"] }): WellnessReadinessResult {
  const core = { ...createDefaultWellnessCore(), ...input.core };
  const overall = calculateOverallWellness(core);
  const baseValue = clampWellness(input.baseValue ?? Math.round((overall + core.energy + (100 - core.fatigue) + core.sleep_quality) / 4));
  const normalized = normalizeWellnessModifiers(input.modifiers ?? []);
  let additive = 0;
  let multiplier = 1;
  for (const modifier of normalized) {
    const value = modifier.cappedValue ?? modifier.rawValue;
    if (modifier.mode === "multiplicative") multiplier += value;
    else additive += value * 100;
  }
  const positiveTotal = normalized.filter((m) => (m.cappedValue ?? 0) > 0).reduce((s, m) => s + (m.cappedValue ?? 0), 0);
  const negativeTotal = normalized.filter((m) => (m.cappedValue ?? 0) < 0).reduce((s, m) => s + (m.cappedValue ?? 0), 0);
  const boundedPositive = Math.min(WELLNESS_CANONICAL_BALANCE.globalModifierCaps.positive, positiveTotal);
  const boundedNegative = Math.max(WELLNESS_CANONICAL_BALANCE.globalModifierCaps.negative, negativeTotal);
  const cappedContributors = normalized.filter((m) => (m.cappedValue ?? m.rawValue) !== m.rawValue || positiveTotal > WELLNESS_CANONICAL_BALANCE.globalModifierCaps.positive || negativeTotal < WELLNESS_CANONICAL_BALANCE.globalModifierCaps.negative);
  const restrictedBy = (input.restrictions ?? []).find((r) => WELLNESS_CANONICAL_BALANCE.roleRestrictions[input.role]?.includes(r));
  const rawScore = restrictedBy ? 0 : baseValue * Math.max(0.6, multiplier) + additive + boundedPositive * 100 + boundedNegative * 100;
  const score = clampWellness(rawScore);
  const state = WELLNESS_CANONICAL_BALANCE.readinessThresholds.find((threshold) => score >= threshold.min)?.state ?? "unavailable";
  const performanceModifier = Number(Math.max(1 + WELLNESS_CANONICAL_BALANCE.globalModifierCaps.negative, Math.min(1 + WELLNESS_CANONICAL_BALANCE.globalModifierCaps.positive, 1 + (score - 70) / 250)).toFixed(3));
  const summary = `${input.role.split("_").join(" ")} readiness is ${score}: ${normalized.slice(0, 3).map((m) => m.explanation).join(", ") || "current wellness is the main input"}.`;
  return {
    role: input.role,
    score,
    state,
    performanceModifier,
    risk: clampWellness(100 - score + Math.max(0, core.burnout_risk - 60) / 2),
    explanation: { finalResult: score, baseValue, positiveContributors: normalized.filter((m) => (m.cappedValue ?? 0) > 0), negativeContributors: normalized.filter((m) => (m.cappedValue ?? 0) < 0), cappedContributors, ignoredContributors: [], appliedRestriction: restrictedBy, suggestedAction: readinessAction(input.role, score), confidence: input.confidence ?? "actual", summary },
  };
}

export function buildCoreWellnessModifiers(core: Partial<WellnessCoreValues>, target: WellnessReadinessRole): WellnessModifier[] {
  const values = { ...createDefaultWellnessCore(), ...core };
  const modifiers: WellnessModifier[] = [];
  if (values.energy >= 80) modifiers.push({ id: `core-energy-good:${target}`, source: "core_wellness", category: "energy", target, rawValue: 0.04, stackingGroup: "energy", priority: 50, mode: "additive", mayStack: false, explanation: "good energy increased readiness", diagnosticId: "wellness.core.energy.good" });
  if (values.energy < 35) modifiers.push({ id: `core-energy-low:${target}`, source: "core_wellness", category: "energy", target, rawValue: -0.09, stackingGroup: "energy", priority: 60, mode: "additive", mayStack: false, explanation: "low energy reduced readiness", diagnosticId: "wellness.core.energy.low" });
  if (values.fatigue > 75) modifiers.push({ id: `core-fatigue-high:${target}`, source: "core_wellness", category: "energy", target, rawValue: -0.11, stackingGroup: "fatigue", priority: 60, mode: "additive", mayStack: false, explanation: "high fatigue reduced readiness", diagnosticId: "wellness.core.fatigue.high" });
  if (values.sleep_quality >= 78) modifiers.push({ id: `core-sleep-good:${target}`, source: "core_wellness", category: "sleep", target, rawValue: 0.03, stackingGroup: "sleep", priority: 40, mode: "additive", mayStack: false, explanation: "quality sleep improved readiness", diagnosticId: "wellness.core.sleep.good" });
  if (values.burnout_risk > 75) modifiers.push({ id: `core-burnout-high:${target}`, source: "core_wellness", category: "burnout", target, rawValue: -0.1, stackingGroup: "burnout", priority: 70, mode: "additive", mayStack: false, explanation: "burnout pressure reduced readiness", diagnosticId: "wellness.core.burnout.high" });
  return modifiers;
}
