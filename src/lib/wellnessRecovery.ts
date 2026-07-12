import { getVehicleTier, type VehicleTier } from "@/lib/tourVehicles";
import { clampWellness, createDefaultWellnessCore, getPerformanceModifier, type WellnessCoreValues } from "@/lib/wellnessSystem";

export type AccommodationRecoveryTier = "none" | "basic" | "standard" | "premium" | "specialist";
export type AccommodationKind = "none" | "home" | "hotel" | "temporary" | "vehicle";
export type TourLoadState = "comfortable" | "active" | "demanding" | "exhausting" | "unsustainable";

export interface AccommodationRecoveryProfile {
  id: string;
  name: string;
  kind: AccommodationKind;
  tier: AccommodationRecoveryTier;
  location?: string;
  sleep_quality_modifier: number;
  energy_recovery_modifier: number;
  fatigue_recovery_modifier: number;
  stress_recovery_modifier: number;
  strain_recovery_modifier: number;
  condition_recovery_modifier: number;
  privacy_modifier: number;
  noise_modifier: number;
  comfort_rating: number;
  cleanliness_rating: number;
  safety_rating: number;
  recovery_capacity: number;
  cost_per_night_cents?: number;
  facilities: string[];
}

export interface AccommodationSource {
  id?: string;
  name?: string;
  kind?: AccommodationKind;
  tier?: AccommodationRecoveryTier | "budget" | "comfort";
  location?: string;
  quality?: number;
  pricePerNightCents?: number;
  occupied?: boolean;
  isHomeCity?: boolean;
  upgrades?: string[];
  attributes?: Partial<Record<"bed_quality" | "kitchen_quality" | "privacy" | "noise_level" | "comfort" | "cleanliness" | "safety" | "neighbourhood_stress", number>>;
}

export interface TransportWellnessProfile {
  vehicleTier: VehicleTier | "plane" | "ferry" | "train";
  travel_comfort: number;
  sleep_capability: number;
  noise: number;
  vibration: number;
  personal_space: number;
  climate_control: number;
  seating_quality: number;
  movement_during_travel: number;
  recovery_efficiency: number;
  privacy: number;
  onboard_facilities: string[];
}

export interface TravelSegmentInput {
  id: string;
  durationHours: number;
  distanceKm: number;
  vehicleTier: VehicleTier | "plane" | "ferry" | "train";
  departsAt?: string;
  arrivesAt?: string;
  timezoneDeltaHours?: number;
  transfers?: number;
  delayHours?: number;
  upgrades?: string[];
  alreadyProcessedIds?: string[];
}

export interface TravelFatigueEffect {
  idempotencyKey: string;
  processed: boolean;
  energyDelta: number;
  fatigueDelta: number;
  stressDelta: number;
  sleepQualityDelta: number;
  backStrainRisk: number;
  conditionRecoveryModifier: number;
  arrivalReadiness: number;
  partialSleepHours: number;
  jetLagHours: number;
  summary: string;
}

export interface TourLoadInput {
  travelHours: number;
  distanceKm: number;
  consecutiveNightsAway: number;
  consecutiveGigs: number;
  restDays: number;
  accommodationScore: number;
  transportComfort: number;
  timezoneDeltaHours?: number;
  strain?: number;
  activeConditions?: number;
}

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0));
const round = (n: number) => Math.round(n * 100) / 100;

export const WELLNESS_RECOVERY_BALANCE = {
  maxAccommodationBonus: 0.2,
  maxSpecialistBonus: 0.28,
  maxTravelPenalty: 28,
  maxUpgradeBonus: 12,
  accommodationDefaults: {
    none: { sleep: -18, energy: -0.18, fatigue: -0.16, stress: -0.12, strain: -0.08, condition: -0.08, privacy: -15, noise: 28, comfort: 20, cleanliness: 35, safety: 55, capacity: 1 },
    basic: { sleep: 0, energy: 0, fatigue: 0, stress: 0, strain: 0, condition: 0, privacy: 0, noise: 0, comfort: 50, cleanliness: 55, safety: 60, capacity: 1 },
    standard: { sleep: 7, energy: 0.06, fatigue: 0.06, stress: 0.06, strain: 0.03, condition: 0.03, privacy: 6, noise: -4, comfort: 65, cleanliness: 68, safety: 70, capacity: 2 },
    premium: { sleep: 13, energy: 0.14, fatigue: 0.14, stress: 0.16, strain: 0.08, condition: 0.08, privacy: 14, noise: -10, comfort: 82, cleanliness: 85, safety: 82, capacity: 2 },
    specialist: { sleep: 18, energy: 0.18, fatigue: 0.2, stress: 0.2, strain: 0.12, condition: 0.12, privacy: 16, noise: -12, comfort: 88, cleanliness: 92, safety: 86, capacity: 2 },
  },
  tourLoadThresholds: [
    { state: "comfortable", max: 24 },
    { state: "active", max: 42 },
    { state: "demanding", max: 62 },
    { state: "exhausting", max: 82 },
    { state: "unsustainable", max: Infinity },
  ] as const,
};

const normalizeTier = (tier?: AccommodationSource["tier"]): AccommodationRecoveryTier => {
  if (tier === "budget") return "basic";
  if (tier === "comfort") return "premium";
  return tier ?? "standard";
};

export function resolveAccommodationRecoveryProfile(source?: AccommodationSource | null): AccommodationRecoveryProfile {
  if (!source || source.occupied === false) source = { kind: "none", tier: "none", name: "No proper accommodation" };
  const tier = normalizeTier(source.tier) === "none" || source.kind === "none" ? "none" : normalizeTier(source.tier);
  const defaults = WELLNESS_RECOVERY_BALANCE.accommodationDefaults[tier];
  const attrs = source.attributes ?? {};
  const quality = clamp(source.quality ?? defaults.comfort, 0, 100);
  const homeBonus = source.kind === "home" ? 5 : 0;
  const upgradeBonus = Math.min(WELLNESS_RECOVERY_BALANCE.maxUpgradeBonus, (source.upgrades ?? []).length * 3);
  const comfort = clamp((attrs.comfort ?? quality) + homeBonus + upgradeBonus);
  const cleanliness = clamp(attrs.cleanliness ?? (defaults.cleanliness + (quality - 50) * 0.25));
  const safety = clamp(attrs.safety ?? defaults.safety);
  const noise = clamp(defaults.noise + (attrs.noise_level ?? 0) - upgradeBonus, -30, 40);
  const bedBonus = ((attrs.bed_quality ?? quality) - 50) / 100;
  const cap = tier === "specialist" ? WELLNESS_RECOVERY_BALANCE.maxSpecialistBonus : WELLNESS_RECOVERY_BALANCE.maxAccommodationBonus;
  return {
    id: source.id ?? `${source.kind ?? "none"}-${tier}`,
    name: source.name ?? (source.kind === "home" ? "Home" : tier === "none" ? "No proper accommodation" : `${tier} accommodation`),
    kind: source.kind ?? "hotel",
    tier,
    location: source.location,
    sleep_quality_modifier: clamp(defaults.sleep + bedBonus * 10 + homeBonus + upgradeBonus * 0.5, -25, 25),
    energy_recovery_modifier: round(Math.max(-0.25, Math.min(cap, defaults.energy + bedBonus * 0.05 + upgradeBonus / 200))),
    fatigue_recovery_modifier: round(Math.max(-0.25, Math.min(cap, defaults.fatigue + (comfort - 50) / 500 + upgradeBonus / 200))),
    stress_recovery_modifier: round(Math.max(-0.25, Math.min(cap, defaults.stress + (source.isHomeCity ? 0.06 : 0) - (attrs.neighbourhood_stress ?? 0) / 500 + upgradeBonus / 250))),
    strain_recovery_modifier: round(Math.max(-0.12, Math.min(0.15, defaults.strain + upgradeBonus / 400))),
    condition_recovery_modifier: round(Math.max(-0.12, Math.min(0.15, defaults.condition + upgradeBonus / 500))),
    privacy_modifier: clamp(defaults.privacy + (attrs.privacy ?? 0) / 2 + homeBonus),
    noise_modifier: noise,
    comfort_rating: Math.round(comfort),
    cleanliness_rating: Math.round(cleanliness),
    safety_rating: Math.round(safety),
    recovery_capacity: defaults.capacity,
    cost_per_night_cents: source.pricePerNightCents,
    facilities: [...(source.upgrades ?? []), ...(source.kind === "home" ? ["familiar space"] : [])],
  };
}

export function getTransportWellnessProfile(vehicleTier: TravelSegmentInput["vehicleTier"], upgrades: string[] = []): TransportWellnessProfile {
  const vehicle = typeof vehicleTier === "string" && ["plane", "ferry", "train"].includes(vehicleTier) ? null : getVehicleTier(vehicleTier as VehicleTier);
  const comfort = vehicle ? vehicle.comfort * 14 : vehicleTier === "plane" ? 70 : vehicleTier === "train" ? 62 : 52;
  const bunkBonus = upgrades.includes("sleeping_bunks") ? 18 : 0;
  const soundBonus = upgrades.includes("soundproofing") ? 10 : 0;
  return {
    vehicleTier,
    travel_comfort: clamp(comfort + (upgrades.includes("premium_seating") ? 8 : 0)),
    sleep_capability: clamp((vehicle?.perks.some((p) => /bunk|suite/i.test(p)) ? 55 : 8) + bunkBonus + (upgrades.includes("premium_mattresses") ? 10 : 0)),
    noise: clamp(70 - comfort / 2 - soundBonus),
    vibration: clamp(vehicleTier === "plane" ? 25 : vehicleTier === "train" ? 18 : 78 - comfort / 2 - (upgrades.includes("better_suspension") ? 12 : 0)),
    personal_space: clamp(comfort + (upgrades.includes("private_cabins") ? 12 : 0)),
    climate_control: clamp(comfort + (upgrades.includes("climate_control") ? 14 : 0)),
    seating_quality: clamp(comfort + (upgrades.includes("premium_seating") ? 12 : 0)),
    movement_during_travel: clamp(vehicleTier === "plane" ? 20 : 50 + comfort / 3),
    recovery_efficiency: clamp(20 + comfort * 0.45 + bunkBonus * 0.5),
    privacy: clamp(comfort + (upgrades.includes("private_cabins") ? 15 : 0)),
    onboard_facilities: [...(vehicle?.perks ?? []), ...upgrades],
  };
}

export function calculateTravelFatigueEffect(segment: TravelSegmentInput, current: Partial<WellnessCoreValues> = {}): TravelFatigueEffect {
  const key = `travel-fatigue:${segment.id}`;
  if (segment.alreadyProcessedIds?.includes(key)) return { idempotencyKey: key, processed: false, energyDelta: 0, fatigueDelta: 0, stressDelta: 0, sleepQualityDelta: 0, backStrainRisk: 0, conditionRecoveryModifier: 0, arrivalReadiness: Math.round(getPerformanceModifier(current) * 100), partialSleepHours: 0, jetLagHours: 0, summary: "Travel fatigue already processed." };
  const t = getTransportWellnessProfile(segment.vehicleTier, segment.upgrades);
  const duration = Math.max(0, segment.durationHours + (segment.delayHours ?? 0));
  const discomfort = (100 - t.travel_comfort) / 100;
  const longHaul = Math.max(0, duration - 3);
  const transferStress = (segment.transfers ?? 0) * 1.5;
  const jetLagHours = Math.min(48, Math.max(0, Math.abs(segment.timezoneDeltaHours ?? 0) * 6));
  const partialSleepHours = Math.min(duration * 0.55, Math.max(0, duration - 2) * t.sleep_capability / 100);
  const sleepCredit = partialSleepHours * (t.recovery_efficiency / 100) * 1.4;
  const fatigueDelta = clamp(longHaul * (0.9 + discomfort) + transferStress + jetLagHours / 12 - sleepCredit, 0, WELLNESS_RECOVERY_BALANCE.maxTravelPenalty);
  const stressDelta = clamp(duration * 0.3 * discomfort + transferStress + (segment.delayHours ?? 0) * 0.8, 0, 16);
  const energyDelta = -clamp(duration * 0.9 + fatigueDelta * 0.55 - sleepCredit * 1.8, 1, 24);
  const sleepQualityDelta = -clamp(t.noise / 12 + t.vibration / 14 + jetLagHours / 10 - partialSleepHours, 0, 22);
  const projected = { ...createDefaultWellnessCore(), ...current };
  const readiness = clampWellness(projected.energy + energyDelta - (projected.fatigue + fatigueDelta) * 0.35 - stressDelta * 0.25 - jetLagHours * 0.15);
  return { idempotencyKey: key, processed: true, energyDelta: Math.round(energyDelta), fatigueDelta: Math.round(fatigueDelta), stressDelta: Math.round(stressDelta), sleepQualityDelta: Math.round(sleepQualityDelta), backStrainRisk: round(clamp((duration - 4) * discomfort / 100, 0, 0.18)), conditionRecoveryModifier: round(-Math.min(0.2, fatigueDelta / 140 + jetLagHours / 300)), arrivalReadiness: readiness, partialSleepHours: round(partialSleepHours), jetLagHours, summary: fatigueDelta >= 14 ? "High travel fatigue expected; add recovery time before performing." : partialSleepHours >= 4 ? "Partial sleep available during travel, but recovery is still below a proper bed." : "Travel effects are manageable with normal recovery." };
}

export function calculateTourLoadState(input: TourLoadInput) {
  const raw = input.travelHours * 1.4 + input.distanceKm / 180 + input.consecutiveNightsAway * 2 + input.consecutiveGigs * 7 + (input.timezoneDeltaHours ?? 0) * 3 + (input.strain ?? 0) * 0.15 + (input.activeConditions ?? 0) * 8;
  const mitigated = raw - input.restDays * 14 - input.accommodationScore * 0.12 - input.transportComfort * 0.1;
  const score = clamp(mitigated);
  const state = WELLNESS_RECOVERY_BALANCE.tourLoadThresholds.find((t) => score <= t.max)?.state ?? "unsustainable";
  return { score: Math.round(score), state: state as TourLoadState, fatigueModifier: round(1 + score / 220), stressModifier: round(1 + score / 260), performanceModifier: round(1 - Math.min(0.28, score / 360)), needsRest: score >= 62 };
}

export function forecastWellnessAfterRecovery(current: Partial<WellnessCoreValues>, accommodation: AccommodationRecoveryProfile, travel?: TravelFatigueEffect, restDays = 0) {
  const base = { ...createDefaultWellnessCore(), ...current };
  const restMultiplier = 1 + restDays * 0.18;
  const next: WellnessCoreValues = {
    ...base,
    energy: clampWellness(base.energy + 18 * (1 + accommodation.energy_recovery_modifier) * restMultiplier + (travel?.energyDelta ?? 0)),
    fatigue: clampWellness(base.fatigue - 16 * (1 + accommodation.fatigue_recovery_modifier) * restMultiplier + (travel?.fatigueDelta ?? 0)),
    stress: clampWellness(base.stress - 8 * (1 + accommodation.stress_recovery_modifier) * restMultiplier + (travel?.stressDelta ?? 0)),
    sleep_quality: clampWellness(base.sleep_quality + accommodation.sleep_quality_modifier + (travel?.sleepQualityDelta ?? 0)),
    physical_health: clampWellness(base.physical_health + 2 * (1 + accommodation.condition_recovery_modifier)),
    motivation: clampWellness(base.motivation + (accommodation.kind === "home" ? 2 : 0) - (travel?.jetLagHours ?? 0) / 16),
    burnout_risk: clampWellness(base.burnout_risk - 4 * restMultiplier + Math.max(0, (travel?.fatigueDelta ?? 0) - 10) / 2),
  };
  return { values: next, readiness: Math.round(getPerformanceModifier(next) * 100), label: "Estimated forecast — actual outcomes may vary with activities, ailments and delays." };
}
