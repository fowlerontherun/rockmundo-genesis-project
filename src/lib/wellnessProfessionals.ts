import type { WellnessCoreValues, WellnessTierKey } from "./wellnessSystem";
import { clampWellness } from "./wellnessSystem";

export type WellnessProfessionalRole =
  | "personal_trainer"
  | "physiotherapist"
  | "therapist"
  | "nutritionist"
  | "vocal_coach"
  | "massage_therapist"
  | "wellness_coach";
export type ProviderKind = "npc" | "player";
export type QualificationTier = "trainee" | "qualified" | "experienced" | "expert" | "elite";
export type WellnessServiceSlug =
  | "personal_training_session"
  | "physiotherapy_assessment"
  | "physiotherapy_treatment"
  | "therapy_session"
  | "nutrition_consultation"
  | "vocal_coaching_session"
  | "massage_session"
  | "wellness_review";
export type AppointmentStatus = "requested" | "booked" | "cancelled_early" | "cancelled_late" | "client_no_show" | "provider_no_show" | "completed" | "refunded" | "disputed";

export interface ProfessionalRoleDefinition {
  role: WellnessProfessionalRole;
  label: string;
  summary: string;
  relevantSkills: string[];
  minimumSkills: Record<string, number>;
  supportedServices: WellnessServiceSlug[];
  supportedConditions: string[];
  preventativeEffects: Partial<Record<keyof WellnessCoreValues | "vocal_readiness" | "stage_stamina", number>>;
  recoveryEffects: Partial<Record<keyof WellnessCoreValues | "strain" | "vocal_strain", number>>;
  appointmentDurations: number[];
  baseFeeCents: number;
  priceBoundsCents: { min: number; max: number };
  contractAvailable: boolean;
  progressionUnlock: WellnessTierKey;
  locationRequirements: string[];
  remoteEligible: boolean;
  maxBonusCap: number;
  compatibleCompanyTypes: string[];
}

export interface WellnessServiceDefinition {
  slug: WellnessServiceSlug;
  label: string;
  roles: WellnessProfessionalRole[];
  durationMinutes: number;
  baseFeeCents: number;
  minEligibleFeeCents: number;
  compatibleConditions: string[];
  outcomeStats: Partial<Record<keyof WellnessCoreValues | "strain" | "vocal_readiness" | "vocal_strain" | "stage_stamina", number>>;
  immediateFatigueDelta?: number;
  requiresAttendance: boolean;
  remoteEligible: boolean;
  minimumQualification: QualificationTier;
}

export const QUALIFICATION_THRESHOLDS: Record<QualificationTier, { skillAverage: number; completedServices: number; reputation: number; reliability: number }> = {
  trainee: { skillAverage: 15, completedServices: 0, reputation: 0, reliability: 50 },
  qualified: { skillAverage: 35, completedServices: 8, reputation: 20, reliability: 70 },
  experienced: { skillAverage: 55, completedServices: 35, reputation: 45, reliability: 78 },
  expert: { skillAverage: 72, completedServices: 100, reputation: 70, reliability: 86 },
  elite: { skillAverage: 88, completedServices: 250, reputation: 90, reliability: 94 },
};

export const WELLNESS_PROFESSIONAL_BALANCE = {
  npcQuality: { trainee: 0.72, qualified: 0.82, experienced: 0.9, expert: 0.96, elite: 1.0 },
  playerAdvantageCap: 0.18,
  familiarityCap: 0.06,
  severeConditionMaxRecovery: 12,
  dailyXpCap: 90,
  weeklyXpCap: 320,
  repeatedPairDiminishingAfter: 3,
  cancellation: { earlyRefundRate: 0.9, lateRefundRate: 0.5, noShowRefundRate: 0 },
  reputationThresholds: [
    { label: "New", min: 0 },
    { label: "Developing", min: 20 },
    { label: "Trusted", min: 45 },
    { label: "Respected", min: 65 },
    { label: "Leading", min: 82 },
    { label: "Elite", min: 94 },
  ],
} as const;

export const WELLNESS_PROFESSIONAL_ROLES: Record<WellnessProfessionalRole, ProfessionalRoleDefinition> = {
  personal_trainer: { role: "personal_trainer", label: "Personal Trainer", summary: "Fitness, stage stamina, fatigue management and physical-strain prevention.", relevantSkills: ["fitness", "coaching", "organisation", "reliability"], minimumSkills: { fitness: 30, coaching: 20 }, supportedServices: ["personal_training_session", "wellness_review"], supportedConditions: ["fatigue", "physical_strain", "tour_conditioning"], preventativeEffects: { fitness: 8, stage_stamina: 6, fatigue: -3 }, recoveryEffects: { fatigue: -2, physical_health: 3 }, appointmentDurations: [45, 60, 90], baseFeeCents: 8000, priceBoundsCents: { min: 4000, max: 22000 }, contractAvailable: true, progressionUnlock: "new_artist", locationRequirements: ["gym", "park", "venue"], remoteEligible: false, maxBonusCap: 0.16, compatibleCompanyTypes: ["gym", "wellness_center", "tour_company", "management_company", "band_organisation"] },
  physiotherapist: { role: "physiotherapist", label: "Physiotherapist", summary: "Fictional performance-care for muscular strain, rehab planning and return-to-performance readiness.", relevantSkills: ["physiotherapy", "medical_care", "empathy", "reliability"], minimumSkills: { physiotherapy: 40, medical_care: 25 }, supportedServices: ["physiotherapy_assessment", "physiotherapy_treatment", "wellness_review"], supportedConditions: ["muscle_strain", "sprained_wrist", "back_pain", "shoulder_strain"], preventativeEffects: { physical_health: 5, fatigue: -2 }, recoveryEffects: { strain: -10, physical_health: 6 }, appointmentDurations: [45, 60], baseFeeCents: 12000, priceBoundsCents: { min: 7000, max: 30000 }, contractAvailable: true, progressionUnlock: "professional_artist", locationRequirements: ["clinic", "wellness_center", "venue"], remoteEligible: false, maxBonusCap: 0.18, compatibleCompanyTypes: ["clinic", "wellness_center", "tour_company", "large_venue", "band_organisation"] },
  therapist: { role: "therapist", label: "Therapist", summary: "Game-focused support for stress, motivation, confidence, burnout risk and band pressure.", relevantSkills: ["psychology", "empathy", "communication", "reliability"], minimumSkills: { psychology: 40, empathy: 25 }, supportedServices: ["therapy_session", "wellness_review"], supportedConditions: ["stress", "burnout_warning", "tour_pressure", "band_conflict"], preventativeEffects: { stress: -6, burnout_risk: -5, motivation: 4 }, recoveryEffects: { happiness: 5, stress: -8, motivation: 4 }, appointmentDurations: [45, 60], baseFeeCents: 11000, priceBoundsCents: { min: 6000, max: 28000 }, contractAvailable: true, progressionUnlock: "professional_artist", locationRequirements: ["clinic", "wellness_center", "remote"], remoteEligible: true, maxBonusCap: 0.16, compatibleCompanyTypes: ["clinic", "wellness_center", "management_company", "hotel", "band_organisation"] },
  nutritionist: { role: "nutritionist", label: "Nutritionist", summary: "Meal plans, hydration targets, tour catering and recovery food preparation.", relevantSkills: ["nutrition", "coaching", "organisation", "communication"], minimumSkills: { nutrition: 35, coaching: 15 }, supportedServices: ["nutrition_consultation", "wellness_review"], supportedConditions: ["poor_nutrition", "dehydration", "tour_catering"], preventativeEffects: { nutrition: 9, energy: 3 }, recoveryEffects: { nutrition: 8, energy: 3, fatigue: -2 }, appointmentDurations: [30, 45, 60], baseFeeCents: 7000, priceBoundsCents: { min: 3500, max: 18000 }, contractAvailable: true, progressionUnlock: "active_musician", locationRequirements: ["wellness_center", "restaurant", "remote"], remoteEligible: true, maxBonusCap: 0.14, compatibleCompanyTypes: ["wellness_center", "hotel", "tour_company", "management_company", "band_organisation"] },
  vocal_coach: { role: "vocal_coach", label: "Vocal Coach", summary: "Vocal readiness, warm-up plans, vocal strain prevention and singing consistency.", relevantSkills: ["vocal_technique", "coaching", "communication", "reliability"], minimumSkills: { vocal_technique: 40, coaching: 20 }, supportedServices: ["vocal_coaching_session", "wellness_review"], supportedConditions: ["vocal_strain", "sore_throat", "pre_gig_warmup"], preventativeEffects: { vocal_readiness: 9, stress: -2 }, recoveryEffects: { vocal_strain: -8, motivation: 3 }, appointmentDurations: [30, 45, 60], baseFeeCents: 9000, priceBoundsCents: { min: 5000, max: 24000 }, contractAvailable: true, progressionUnlock: "active_musician", locationRequirements: ["studio", "venue", "remote"], remoteEligible: true, maxBonusCap: 0.17, compatibleCompanyTypes: ["recording_studio", "tour_company", "management_company", "large_venue", "band_organisation"] },
  massage_therapist: { role: "massage_therapist", label: "Massage Therapist", summary: "Short-term fatigue and compatible muscular-strain recovery after heavy performance load.", relevantSkills: ["medical_care", "empathy", "reliability"], minimumSkills: { medical_care: 25, empathy: 20 }, supportedServices: ["massage_session"], supportedConditions: ["fatigue", "muscle_strain", "back_pain"], preventativeEffects: { fatigue: -4, stress: -3 }, recoveryEffects: { fatigue: -10, strain: -5 }, appointmentDurations: [45, 60, 90], baseFeeCents: 6500, priceBoundsCents: { min: 3500, max: 16000 }, contractAvailable: false, progressionUnlock: "new_artist", locationRequirements: ["wellness_center", "hotel", "venue"], remoteEligible: false, maxBonusCap: 0.12, compatibleCompanyTypes: ["wellness_center", "hotel", "large_venue", "tour_company"] },
  wellness_coach: { role: "wellness_coach", label: "Wellness Coach", summary: "Early-career generalist for basic routines, sleep, stress, nutrition and recovery planning.", relevantSkills: ["coaching", "communication", "empathy", "organisation"], minimumSkills: { coaching: 20, communication: 15 }, supportedServices: ["wellness_review", "nutrition_consultation", "personal_training_session"], supportedConditions: ["basic_routine", "sleep", "stress", "poor_nutrition"], preventativeEffects: { sleep_quality: 4, stress: -4, nutrition: 4 }, recoveryEffects: { fatigue: -3, motivation: 3 }, appointmentDurations: [30, 45, 60], baseFeeCents: 4500, priceBoundsCents: { min: 2000, max: 12000 }, contractAvailable: true, progressionUnlock: "new_artist", locationRequirements: ["wellness_center", "home", "remote"], remoteEligible: true, maxBonusCap: 0.1, compatibleCompanyTypes: ["wellness_center", "gym", "hotel", "management_company", "band_organisation"] },
};

export const WELLNESS_SERVICES: Record<WellnessServiceSlug, WellnessServiceDefinition> = {
  personal_training_session: { slug: "personal_training_session", label: "Personal Training Session", roles: ["personal_trainer", "wellness_coach"], durationMinutes: 60, baseFeeCents: 8000, minEligibleFeeCents: 3000, compatibleConditions: ["fatigue", "tour_conditioning", "physical_strain"], outcomeStats: { fitness: 6, stage_stamina: 6, stress: -3 }, immediateFatigueDelta: 4, requiresAttendance: true, remoteEligible: false, minimumQualification: "trainee" },
  physiotherapy_assessment: { slug: "physiotherapy_assessment", label: "Physiotherapy Assessment", roles: ["physiotherapist"], durationMinutes: 45, baseFeeCents: 10000, minEligibleFeeCents: 6000, compatibleConditions: ["muscle_strain", "sprained_wrist", "back_pain", "shoulder_strain"], outcomeStats: { physical_health: 3, strain: -4 }, requiresAttendance: true, remoteEligible: false, minimumQualification: "qualified" },
  physiotherapy_treatment: { slug: "physiotherapy_treatment", label: "Physiotherapy Treatment", roles: ["physiotherapist"], durationMinutes: 60, baseFeeCents: 14000, minEligibleFeeCents: 8000, compatibleConditions: ["muscle_strain", "sprained_wrist", "back_pain", "shoulder_strain"], outcomeStats: { physical_health: 6, strain: -10 }, requiresAttendance: true, remoteEligible: false, minimumQualification: "qualified" },
  therapy_session: { slug: "therapy_session", label: "Therapy Session", roles: ["therapist"], durationMinutes: 60, baseFeeCents: 11000, minEligibleFeeCents: 6000, compatibleConditions: ["stress", "burnout_warning", "tour_pressure", "band_conflict"], outcomeStats: { stress: -10, motivation: 5, burnout_risk: -6, happiness: 4 }, requiresAttendance: true, remoteEligible: true, minimumQualification: "qualified" },
  nutrition_consultation: { slug: "nutrition_consultation", label: "Nutrition Consultation", roles: ["nutritionist", "wellness_coach"], durationMinutes: 45, baseFeeCents: 7000, minEligibleFeeCents: 3500, compatibleConditions: ["poor_nutrition", "dehydration", "tour_catering"], outcomeStats: { nutrition: 10, energy: 3, fatigue: -2 }, requiresAttendance: true, remoteEligible: true, minimumQualification: "trainee" },
  vocal_coaching_session: { slug: "vocal_coaching_session", label: "Vocal Coaching Session", roles: ["vocal_coach"], durationMinutes: 45, baseFeeCents: 9000, minEligibleFeeCents: 5000, compatibleConditions: ["vocal_strain", "sore_throat", "pre_gig_warmup"], outcomeStats: { vocal_readiness: 10, vocal_strain: -6, motivation: 3 }, requiresAttendance: true, remoteEligible: true, minimumQualification: "qualified" },
  massage_session: { slug: "massage_session", label: "Massage Session", roles: ["massage_therapist"], durationMinutes: 60, baseFeeCents: 6500, minEligibleFeeCents: 3500, compatibleConditions: ["fatigue", "muscle_strain", "back_pain"], outcomeStats: { fatigue: -14, strain: -5, stress: -4 }, requiresAttendance: true, remoteEligible: false, minimumQualification: "trainee" },
  wellness_review: { slug: "wellness_review", label: "Wellness Review", roles: ["wellness_coach", "personal_trainer", "therapist", "nutritionist", "physiotherapist", "vocal_coach"], durationMinutes: 45, baseFeeCents: 4500, minEligibleFeeCents: 2000, compatibleConditions: ["basic_routine", "sleep", "stress", "poor_nutrition", "tour_pressure"], outcomeStats: { sleep_quality: 3, stress: -3, nutrition: 3, motivation: 3 }, requiresAttendance: true, remoteEligible: true, minimumQualification: "trainee" },
};

const tierRank: QualificationTier[] = ["trainee", "qualified", "experienced", "expert", "elite"];
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function deriveQualificationTier(input: { role: WellnessProfessionalRole; skills: Record<string, number>; completedServices?: number; reputation?: number; reliability?: number; serverAssignedTier?: QualificationTier }): QualificationTier | null {
  if (input.serverAssignedTier) return input.serverAssignedTier;
  const role = WELLNESS_PROFESSIONAL_ROLES[input.role];
  if (Object.entries(role.minimumSkills).some(([skill, min]) => (input.skills[skill] ?? 0) < min)) return null;
  const average = role.relevantSkills.reduce((sum, skill) => sum + (input.skills[skill] ?? 0), 0) / role.relevantSkills.length;
  let best: QualificationTier = "trainee";
  for (const tier of tierRank) {
    const threshold = QUALIFICATION_THRESHOLDS[tier];
    if (average >= threshold.skillAverage && (input.completedServices ?? 0) >= threshold.completedServices && (input.reputation ?? 0) >= threshold.reputation && (input.reliability ?? 100) >= threshold.reliability) best = tier;
  }
  return best;
}

export function canListService(input: { role: WellnessProfessionalRole; service: WellnessServiceSlug; qualification: QualificationTier | null; priceCents: number }) {
  const role = WELLNESS_PROFESSIONAL_ROLES[input.role];
  const service = WELLNESS_SERVICES[input.service];
  if (!role.supportedServices.includes(input.service) || !service.roles.includes(input.role)) return { ok: false as const, reason: "unsupported_service" };
  if (!input.qualification || tierRank.indexOf(input.qualification) < tierRank.indexOf(service.minimumQualification)) return { ok: false as const, reason: "qualification_required" };
  if (input.priceCents < role.priceBoundsCents.min || input.priceCents > role.priceBoundsCents.max) return { ok: false as const, reason: "price_out_of_bounds" };
  return { ok: true as const };
}

export function calculateServiceOutcome(input: { providerKind: ProviderKind; role: WellnessProfessionalRole; service: WellnessServiceSlug; qualification: QualificationTier; relevantSkillAverage: number; providerWellness: Partial<WellnessCoreValues>; providerReliability: number; clientConditionSeverity?: number; conditionCompatible?: boolean; durationMinutes?: number; locationQuality?: number; carePlanAdherence?: number; familiarityCount?: number; randomFactor?: number }) {
  const role = WELLNESS_PROFESSIONAL_ROLES[input.role];
  const service = WELLNESS_SERVICES[input.service];
  const tierIndex = tierRank.indexOf(input.qualification);
  const skill = clamp(input.relevantSkillAverage, 0, 100) / 100;
  const reliability = clamp(input.providerReliability, 0, 100) / 100;
  const providerFatiguePenalty = clamp(((input.providerWellness.fatigue ?? 35) - 65) / 100, 0, 0.12);
  const providerBurnoutPenalty = clamp(((input.providerWellness.burnout_risk ?? 25) - 70) / 100, 0, 0.1);
  const tierMultiplier = 0.78 + tierIndex * 0.08;
  const skillMultiplier = 0.75 + skill * 0.35;
  const reliabilityMultiplier = 0.85 + reliability * 0.2;
  const locationMultiplier = 0.9 + clamp(input.locationQuality ?? 70, 0, 100) / 500;
  const durationMultiplier = clamp((input.durationMinutes ?? service.durationMinutes) / service.durationMinutes, 0.75, 1.2);
  const compatibilityMultiplier = input.conditionCompatible === false ? 0.45 : 1;
  const planMultiplier = 1 + clamp(input.carePlanAdherence ?? 0, 0, 100) / 1000;
  const familiarityMultiplier = 1 + Math.min(WELLNESS_PROFESSIONAL_BALANCE.familiarityCap, (input.familiarityCount ?? 0) * 0.01);
  const playerMultiplier = input.providerKind === "player" ? 1 + Math.min(WELLNESS_PROFESSIONAL_BALANCE.playerAdvantageCap, Math.max(0, (skill - 0.55) * 0.3 + (reliability - 0.75) * 0.12)) : WELLNESS_PROFESSIONAL_BALANCE.npcQuality[input.qualification];
  const randomMultiplier = clamp(input.randomFactor ?? 1, 0.94, 1.06);
  const quality = clamp(tierMultiplier * skillMultiplier * reliabilityMultiplier * locationMultiplier * durationMultiplier * compatibilityMultiplier * planMultiplier * familiarityMultiplier * playerMultiplier * (1 - providerFatiguePenalty - providerBurnoutPenalty) * randomMultiplier, 0.25, 1 + role.maxBonusCap);
  const severity = clamp(input.clientConditionSeverity ?? 35, 0, 100);
  const maxRecovery = severity >= 70 ? WELLNESS_PROFESSIONAL_BALANCE.severeConditionMaxRecovery : 22;
  const effects = Object.fromEntries(Object.entries(service.outcomeStats).map(([key, value]) => [key, Math.round(clamp(Math.abs(value) * quality, 0, key.includes("strain") || value < 0 ? maxRecovery : 18) * Math.sign(value))]));
  return { quality: Number(quality.toFixed(3)), effects, cappedBySevereCondition: severity >= 70 };
}

export function validateAppointmentRequest(input: { clientId: string; providerId?: string | null; providerKind: ProviderKind; service: WellnessServiceSlug; role: WellnessProfessionalRole; qualification: QualificationTier | null; priceCents: number; clientAvailable: boolean; providerAvailable: boolean; remote: boolean; locationTags?: string[] }) {
  if (input.providerKind === "player" && input.providerId && input.clientId === input.providerId) return { ok: false as const, reason: "self_booking" };
  const listing = canListService({ role: input.role, service: input.service, qualification: input.qualification, priceCents: input.priceCents });
  if (!listing.ok) return listing;
  const role = WELLNESS_PROFESSIONAL_ROLES[input.role];
  const service = WELLNESS_SERVICES[input.service];
  if (input.remote && (!role.remoteEligible || !service.remoteEligible)) return { ok: false as const, reason: "remote_not_allowed" };
  if (!input.remote && input.locationTags && !input.locationTags.some((tag) => role.locationRequirements.includes(tag))) return { ok: false as const, reason: "invalid_location" };
  if (!input.clientAvailable || !input.providerAvailable) return { ok: false as const, reason: "schedule_conflict" };
  return { ok: true as const };
}

export function calculateProfessionalXp(input: { durationMinutes: number; serviceDifficulty?: number; outcomeQuality: number; eligiblePaymentCents: number; refunded?: boolean; pairCompletedThisWeek?: number; dailyAwarded?: number; weeklyAwarded?: number }) {
  if (input.refunded || input.eligiblePaymentCents <= 0) return { xp: 0, diminished: false, capped: false };
  const base = (input.durationMinutes / 30) * 8 * clamp(input.serviceDifficulty ?? 1, 0.5, 2) * clamp(input.outcomeQuality, 0.25, 1.2);
  const repeats = input.pairCompletedThisWeek ?? 0;
  const diminishing = repeats >= WELLNESS_PROFESSIONAL_BALANCE.repeatedPairDiminishingAfter ? 1 / (1 + (repeats - WELLNESS_PROFESSIONAL_BALANCE.repeatedPairDiminishingAfter + 1) * 0.5) : 1;
  const remainingDaily = Math.max(0, WELLNESS_PROFESSIONAL_BALANCE.dailyXpCap - (input.dailyAwarded ?? 0));
  const remainingWeekly = Math.max(0, WELLNESS_PROFESSIONAL_BALANCE.weeklyXpCap - (input.weeklyAwarded ?? 0));
  const xp = Math.floor(Math.min(base * diminishing, remainingDaily, remainingWeekly));
  return { xp, diminished: diminishing < 1, capped: xp < Math.floor(base * diminishing) };
}

export function calculateProfessionalReputation(input: { completedAppointments: number; reliability: number; averageRating?: number; outcomeConsistency?: number; cancellations?: number; disputes?: number }) {
  const experience = Math.min(30, Math.log10(1 + input.completedAppointments) * 16);
  const reliability = clamp(input.reliability, 0, 100) * 0.3;
  const rating = clamp(input.averageRating ?? 3.5, 1, 5) * 8;
  const consistency = clamp(input.outcomeConsistency ?? 70, 0, 100) * 0.15;
  const penalties = (input.cancellations ?? 0) * 1.5 + (input.disputes ?? 0) * 4;
  const score = clamp(Math.round(experience + reliability + rating + consistency - penalties), 0, 100);
  const state = [...WELLNESS_PROFESSIONAL_BALANCE.reputationThresholds].reverse().find((threshold) => score >= threshold.min)?.label ?? "New";
  return { score, state };
}
