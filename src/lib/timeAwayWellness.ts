import { getPerformanceModifier, getWellnessTier, type WellnessCoreValues, type WellnessTierKey } from "@/lib/wellnessSystem";
import { calculateTravelFatigueEffect, forecastWellnessAfterRecovery, resolveAccommodationRecoveryProfile, type AccommodationSource, type TravelSegmentInput } from "@/lib/wellnessRecovery";

export type TimeAwayType = "rest_day" | "staycation" | "city_break" | "standard_holiday" | "wellness_retreat" | "creative_retreat" | "fitness_retreat" | "band_retreat" | "career_break" | "sabbatical";
export type RecoveryFocus = "complete_rest" | "burnout_recovery" | "sleep_reset" | "physical_recovery" | "mental_recovery" | "relationship_time" | "fitness" | "creative_reset" | "social_enjoyment" | "balanced_recovery";
export type ItineraryMode = "manual" | "recommended" | "assisted" | "managed_retreat";
export type CareerMomentumState = "surging" | "strong" | "active" | "quiet" | "dormant";
export type CareerSustainabilityState = "sustainable" | "healthy_workload" | "high_pressure" | "overextended" | "at_risk" | "unsustainable";
export type ReturnReadinessState = "fully_ready" | "ready_with_limits" | "gradual_return_recommended" | "more_recovery_recommended" | "not_ready_for_demanding_activity";

export interface TimeAwayTypeConfig {
  type: TimeAwayType;
  label: string;
  minDays: number;
  maxDays: number;
  unlockTier: WellnessTierKey;
  baseCostCents: number;
  dailyCostCents: number;
  cooldownDays: number;
  noticeDays: number;
  requiresTravel: boolean;
  allowsHome: boolean;
  requiresAccommodation: boolean;
  requiresBandApproval: "never" | "on_conflict" | "always";
  requiresEmploymentLeave: boolean;
  allowedItineraryModes: ItineraryMode[];
  restrictedActivities: string[];
  allowedActivities: string[];
  recovery: { energy: number; fatigue: number; stress: number; sleep: number; burnout: number; motivation: number; happiness: number; fitness?: number };
  careerMomentumDailyCost: number;
  fameEngagementDailyCost: number;
  cancellation: { refundableUntilDays: number; lateFeeRate: number; nonRefundableRate: number };
  description: string;
}

export const TIME_AWAY_TYPES: Record<TimeAwayType, TimeAwayTypeConfig> = {
  rest_day: { type: "rest_day", label: "Rest Day", minDays: 1, maxDays: 1, unlockTier: "new_artist", baseCostCents: 0, dailyCostCents: 0, cooldownDays: 1, noticeDays: 0, requiresTravel: false, allowsHome: true, requiresAccommodation: false, requiresBandApproval: "on_conflict", requiresEmploymentLeave: false, allowedItineraryModes: ["manual", "recommended"], restrictedActivities: ["gig", "tour", "recording", "intensive_rehearsal"], allowedActivities: ["sleep", "relaxation", "quiet_time"], recovery: { energy: 9, fatigue: -12, stress: -5, sleep: 4, burnout: -3, motivation: 1, happiness: 1 }, careerMomentumDailyCost: 0, fameEngagementDailyCost: 0, cancellation: { refundableUntilDays: 0, lateFeeRate: 0, nonRefundableRate: 0 }, description: "Short recovery block that reuses rest-day scheduling and prevents reward farming through cooldowns." },
  staycation: { type: "staycation", label: "Staycation", minDays: 2, maxDays: 7, unlockTier: "new_artist", baseCostCents: 0, dailyCostCents: 1200, cooldownDays: 7, noticeDays: 1, requiresTravel: false, allowsHome: true, requiresAccommodation: false, requiresBandApproval: "on_conflict", requiresEmploymentLeave: false, allowedItineraryModes: ["manual", "recommended", "assisted"], restrictedActivities: ["gig", "tour", "recording", "major_contract"], allowedActivities: ["sleep", "healthy_meals", "relationship_activities", "walking", "quiet_time"], recovery: { energy: 7, fatigue: -8, stress: -7, sleep: 7, burnout: -4, motivation: 2, happiness: 3 }, careerMomentumDailyCost: 0.05, fameEngagementDailyCost: 0.02, cancellation: { refundableUntilDays: 0, lateFeeRate: 0, nonRefundableRate: 0 }, description: "Affordable recovery at home with strong routine stability and no travel fatigue." },
  city_break: { type: "city_break", label: "City Break", minDays: 2, maxDays: 5, unlockTier: "new_artist", baseCostCents: 15000, dailyCostCents: 8500, cooldownDays: 10, noticeDays: 2, requiresTravel: true, allowsHome: false, requiresAccommodation: true, requiresBandApproval: "on_conflict", requiresEmploymentLeave: false, allowedItineraryModes: ["manual", "recommended", "assisted"], restrictedActivities: ["tour", "demanding_recording"], allowedActivities: ["sleep", "sightseeing", "social_activities", "walking"], recovery: { energy: 5, fatigue: -5, stress: -5, sleep: 3, burnout: -3, motivation: 3, happiness: 6 }, careerMomentumDailyCost: 0.08, fameEngagementDailyCost: 0.04, cancellation: { refundableUntilDays: 3, lateFeeRate: 0.25, nonRefundableRate: 0.1 }, description: "Short novelty and happiness break with moderate travel trade-offs." },
  standard_holiday: { type: "standard_holiday", label: "Standard Holiday", minDays: 3, maxDays: 14, unlockTier: "active_musician", baseCostCents: 25000, dailyCostCents: 12000, cooldownDays: 21, noticeDays: 3, requiresTravel: true, allowsHome: false, requiresAccommodation: true, requiresBandApproval: "on_conflict", requiresEmploymentLeave: true, allowedItineraryModes: ["manual", "recommended", "assisted"], restrictedActivities: ["gig", "tour", "recording", "major_contract"], allowedActivities: ["sleep", "relaxation", "sightseeing", "relationship_activities", "swimming"], recovery: { energy: 6, fatigue: -7, stress: -8, sleep: 5, burnout: -5, motivation: 3, happiness: 5 }, careerMomentumDailyCost: 0.12, fameEngagementDailyCost: 0.05, cancellation: { refundableUntilDays: 7, lateFeeRate: 0.35, nonRefundableRate: 0.15 }, description: "Meaningful recovery with visible but gradual opportunity costs." },
  wellness_retreat: { type: "wellness_retreat", label: "Wellness Retreat", minDays: 2, maxDays: 14, unlockTier: "professional_artist", baseCostCents: 45000, dailyCostCents: 18000, cooldownDays: 28, noticeDays: 5, requiresTravel: false, allowsHome: false, requiresAccommodation: true, requiresBandApproval: "on_conflict", requiresEmploymentLeave: true, allowedItineraryModes: ["recommended", "assisted", "managed_retreat"], restrictedActivities: ["gig", "tour", "nightlife", "intensive_rehearsal"], allowedActivities: ["sleep", "therapy", "meditation", "massage", "healthy_meals", "professional_consultation"], recovery: { energy: 6, fatigue: -7, stress: -10, sleep: 7, burnout: -7, motivation: 4, happiness: 3 }, careerMomentumDailyCost: 0.1, fameEngagementDailyCost: 0.04, cancellation: { refundableUntilDays: 10, lateFeeRate: 0.5, nonRefundableRate: 0.25 }, description: "Structured provider-led recovery, capped so it optimises rather than cures." },
  creative_retreat: { type: "creative_retreat", label: "Creative Retreat", minDays: 2, maxDays: 14, unlockTier: "professional_artist", baseCostCents: 30000, dailyCostCents: 10000, cooldownDays: 21, noticeDays: 4, requiresTravel: false, allowsHome: true, requiresAccommodation: false, requiresBandApproval: "on_conflict", requiresEmploymentLeave: true, allowedItineraryModes: ["manual", "recommended", "assisted", "managed_retreat"], restrictedActivities: ["gig", "tour", "media_blitz"], allowedActivities: ["sleep", "quiet_time", "light_songwriting", "walking", "cultural_activity"], recovery: { energy: 4, fatigue: -5, stress: -7, sleep: 4, burnout: -4, motivation: 7, happiness: 4 }, careerMomentumDailyCost: 0.07, fameEngagementDailyCost: 0.03, cancellation: { refundableUntilDays: 7, lateFeeRate: 0.3, nonRefundableRate: 0.15 }, description: "Reduces pressure and improves inspiration without guaranteeing song quality." },
  fitness_retreat: { type: "fitness_retreat", label: "Fitness Retreat", minDays: 2, maxDays: 10, unlockTier: "professional_artist", baseCostCents: 35000, dailyCostCents: 14000, cooldownDays: 28, noticeDays: 5, requiresTravel: false, allowsHome: false, requiresAccommodation: true, requiresBandApproval: "on_conflict", requiresEmploymentLeave: true, allowedItineraryModes: ["recommended", "assisted", "managed_retreat"], restrictedActivities: ["gig", "tour", "nightlife"], allowedActivities: ["sleep", "exercise", "healthy_meals", "physiotherapy", "walking"], recovery: { energy: 3, fatigue: -3, stress: -5, sleep: 4, burnout: -3, motivation: 4, happiness: 3, fitness: 5 }, careerMomentumDailyCost: 0.08, fameEngagementDailyCost: 0.03, cancellation: { refundableUntilDays: 7, lateFeeRate: 0.4, nonRefundableRate: 0.2 }, description: "Improves physical readiness but demanding programmes can add short-term fatigue." },
  band_retreat: { type: "band_retreat", label: "Band Retreat", minDays: 2, maxDays: 7, unlockTier: "active_musician", baseCostCents: 30000, dailyCostCents: 9000, cooldownDays: 30, noticeDays: 7, requiresTravel: false, allowsHome: false, requiresAccommodation: true, requiresBandApproval: "always", requiresEmploymentLeave: false, allowedItineraryModes: ["recommended", "assisted", "managed_retreat"], restrictedActivities: ["public_gig", "tour_leg"], allowedActivities: ["sleep", "planning", "light_rehearsal", "light_songwriting", "conflict_resolution", "social_activities"], recovery: { energy: 4, fatigue: -5, stress: -6, sleep: 3, burnout: -4, motivation: 5, happiness: 4 }, careerMomentumDailyCost: 0.04, fameEngagementDailyCost: 0.02, cancellation: { refundableUntilDays: 7, lateFeeRate: 0.35, nonRefundableRate: 0.15 }, description: "Shared recovery and chemistry benefits only for attending members with diminishing returns." },
  career_break: { type: "career_break", label: "Career Break", minDays: 14, maxDays: 120, unlockTier: "professional_artist", baseCostCents: 0, dailyCostCents: 2500, cooldownDays: 90, noticeDays: 14, requiresTravel: false, allowsHome: true, requiresAccommodation: false, requiresBandApproval: "on_conflict", requiresEmploymentLeave: true, allowedItineraryModes: ["manual", "recommended", "assisted"], restrictedActivities: ["gig", "tour", "recording", "intensive_rehearsal", "major_contract"], allowedActivities: ["sleep", "education", "light_songwriting", "relationships", "low_intensity_wellness", "finance_review"], recovery: { energy: 4, fatigue: -5, stress: -8, sleep: 6, burnout: -8, motivation: 4, happiness: 4 }, careerMomentumDailyCost: 0.35, fameEngagementDailyCost: 0.12, cancellation: { refundableUntilDays: 0, lateFeeRate: 0.05, nonRefundableRate: 0 }, description: "Sustained reduced workload for severe burnout, with recoverable momentum costs." },
  sabbatical: { type: "sabbatical", label: "Sabbatical", minDays: 30, maxDays: 365, unlockTier: "superstar", baseCostCents: 0, dailyCostCents: 3500, cooldownDays: 365, noticeDays: 30, requiresTravel: false, allowsHome: true, requiresAccommodation: false, requiresBandApproval: "on_conflict", requiresEmploymentLeave: true, allowedItineraryModes: ["manual", "recommended", "assisted", "managed_retreat"], restrictedActivities: ["gig", "tour", "recording", "intensive_rehearsal", "major_contract", "media_blitz"], allowedActivities: ["sleep", "relationships", "education", "low_intensity_wellness", "creative_reset", "remote_admin"], recovery: { energy: 3, fatigue: -4, stress: -9, sleep: 7, burnout: -9, motivation: 5, happiness: 5 }, careerMomentumDailyCost: 0.55, fameEngagementDailyCost: 0.18, cancellation: { refundableUntilDays: 0, lateFeeRate: 0.05, nonRefundableRate: 0 }, description: "Advanced long reset with substantial opportunity costs and structured return planning." },
};

export interface WorkloadSummary { gigs: number; tourDays: number; travelHours: number; recordingHours: number; rehearsalHours: number; practiceHours: number; restDays: number; holidays: number; activeConditionDays: number; burnoutDays: number; averageSleep: number; averageRecoveryQuality: number; windowDays: 30 | 90 | 365; }
export interface TimeAwayForecastInput { type: TimeAwayType; startDate: string; endDate: string; focus: RecoveryFocus; vitals: Partial<WellnessCoreValues>; fame?: number; accommodation?: AccommodationSource | null; travel?: TravelSegmentInput | null; existingConflicts?: { schedule?: number; band?: number; work?: number }; professionalSupportQuality?: number; companionCount?: number; budgetCents?: number; }

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0));
const tierRank = (tier: WellnessTierKey) => ["new_artist", "active_musician", "professional_artist", "superstar"].indexOf(tier);
export const daysInclusive = (startDate: string, endDate: string) => Math.floor((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000) + 1;
export function isTimeAwayUnlocked(type: TimeAwayType, fame = 0) { return tierRank(getWellnessTier(fame)) >= tierRank(TIME_AWAY_TYPES[type].unlockTier); }
export function validateTimeAwayRequest(input: TimeAwayForecastInput, today = new Date().toISOString().slice(0, 10)) {
  const config = TIME_AWAY_TYPES[input.type];
  const days = daysInclusive(input.startDate, input.endDate);
  const errors: string[] = [];
  if (input.startDate < today) errors.push("Breaks cannot begin in the past.");
  if (days < config.minDays || days > config.maxDays) errors.push(`${config.label} must be ${config.minDays}-${config.maxDays} days.`);
  if (!isTimeAwayUnlocked(input.type, input.fame ?? 0)) errors.push(`${config.label} is locked until ${config.unlockTier.replace("_", " ")}.`);
  if (config.requiresTravel && !input.travel) errors.push(`${config.label} requires validated travel.`);
  if (config.requiresAccommodation && !input.accommodation) errors.push(`${config.label} requires accommodation or a retreat package.`);
  if ((input.existingConflicts?.band ?? 0) > 0 && config.requiresBandApproval !== "never") errors.push("Band conflicts require approval or rescheduling.");
  return { valid: errors.length === 0, errors, days };
}

export function forecastTimeAway(input: TimeAwayForecastInput) {
  const config = TIME_AWAY_TYPES[input.type];
  const validation = validateTimeAwayRequest(input);
  const days = Math.max(0, validation.days);
  const accommodation = resolveAccommodationRecoveryProfile(input.accommodation ?? { kind: config.allowsHome ? "home" : "hotel", tier: input.type.includes("retreat") ? "specialist" : "standard", isHomeCity: config.allowsHome });
  const travel = input.travel ? calculateTravelFatigueEffect(input.travel, input.vitals) : undefined;
  const baseForecast = forecastWellnessAfterRecovery(input.vitals, accommodation, travel, Math.min(days, 14));
  const focusBoost = input.focus === "balanced_recovery" ? 1 : 1.12;
  const supportBoost = Math.min(0.15, Math.max(0, input.professionalSupportQuality ?? 0) / 700);
  const diminishing = days <= 1 ? 1 : Math.min(1, 0.72 + Math.log2(days + 1) / 7);
  const longBreakPenalty = Math.max(0, days - 14) * config.careerMomentumDailyCost;
  const momentumDelta = -Math.round(Math.min(35, Math.max(0, days * config.careerMomentumDailyCost + longBreakPenalty)));
  const totalCostCents = Math.round(config.baseCostCents + config.dailyCostCents * days + (accommodation.cost_per_night_cents ?? 0) * days + (input.travel ? input.travel.distanceKm * 18 : 0));
  const budgetWarning = input.budgetCents != null && totalCostCents > input.budgetCents;
  return {
    type: input.type,
    label: config.label,
    days,
    valid: validation.valid && !budgetWarning,
    errors: [...validation.errors, ...(budgetWarning ? ["Estimated cost exceeds approved budget."] : [])],
    totalCostCents,
    opportunityCost: { careerMomentumDelta: momentumDelta, fanEngagementDelta: -Math.round(days * config.fameEngagementDailyCost), permanentFameProtected: true },
    wellness: {
      energy: Math.round(baseForecast.values.energy + config.recovery.energy * diminishing),
      fatigue: Math.round(baseForecast.values.fatigue + config.recovery.fatigue * diminishing * focusBoost),
      stress: Math.round(baseForecast.values.stress + config.recovery.stress * diminishing * (1 + supportBoost)),
      sleep_quality: Math.round(baseForecast.values.sleep_quality + config.recovery.sleep * diminishing),
      burnout_risk: Math.round(clamp((input.vitals.burnout_risk ?? 18) + config.recovery.burnout * diminishing * (1 + supportBoost), 0, 100)),
      motivation: Math.round(baseForecast.values.motivation + config.recovery.motivation * diminishing),
    },
    returnReadiness: calculateReturnReadiness({ ...input.vitals, ...baseForecast.values, burnout_risk: clamp((input.vitals.burnout_risk ?? 18) + config.recovery.burnout * diminishing) }, input.type),
    confidence: input.travel ? "medium" : "high",
    notes: [config.description, travel?.summary, accommodation.kind === "home" ? "Home recovery keeps costs low and supports routine stability." : "Accommodation quality modestly changes recovery; it does not cure severe conditions."].filter(Boolean),
  };
}

export function calculateCareerMomentum(input: { recentGigs: number; recentReleases: number; mediaActivity: number; fanEngagement: number; tourDays: number; inactivityDays: number; returnActivity?: number }) {
  const score = clamp(input.recentGigs * 6 + input.recentReleases * 16 + input.mediaActivity * 4 + input.fanEngagement * 0.25 + input.tourDays * 1.3 + (input.returnActivity ?? 0) * 8 - input.inactivityDays * 0.45);
  const state: CareerMomentumState = score >= 82 ? "surging" : score >= 64 ? "strong" : score >= 38 ? "active" : score >= 16 ? "quiet" : "dormant";
  return { score: Math.round(score), state, permanentFameProtected: true };
}

export function calculateCareerSustainability(w: WorkloadSummary) {
  const work = w.gigs * 5 + w.tourDays * 3.2 + w.travelHours * 0.45 + w.recordingHours * 0.9 + w.rehearsalHours * 0.65 + w.practiceHours * 0.35 + w.activeConditionDays * 2 + w.burnoutDays * 3;
  const recovery = w.restDays * 7 + w.holidays * 9 + w.averageSleep * 4 + w.averageRecoveryQuality * 0.35;
  const score = clamp(55 + work / Math.max(1, w.windowDays / 30) - recovery / Math.max(1, w.windowDays / 30));
  const state: CareerSustainabilityState = score < 24 ? "sustainable" : score < 42 ? "healthy_workload" : score < 58 ? "high_pressure" : score < 72 ? "overextended" : score < 88 ? "at_risk" : "unsustainable";
  return { score: Math.round(score), state, mainRiskFactor: w.burnoutDays > 4 ? "burnout days" : w.tourDays > w.restDays ? "tour load" : "stacked commitments", mainProtectiveFactor: w.restDays + w.holidays > 0 ? "planned recovery" : "legacy-safe baseline", legacySafe: w.gigs + w.tourDays + w.travelHours === 0 };
}

export function calculateReturnReadiness(vitals: Partial<WellnessCoreValues>, firstActivity: TimeAwayType | "gig" | "tour" | "recording" | "rehearsal" = "gig") {
  const perf = getPerformanceModifier(vitals) * 100;
  const burnout = vitals.burnout_risk ?? 18;
  const fatigue = vitals.fatigue ?? 35;
  const demanding = ["gig", "tour", "recording"].includes(firstActivity);
  const score = clamp(perf - burnout * 0.35 - fatigue * 0.2 + (demanding ? -8 : 4));
  const state: ReturnReadinessState = score >= 82 ? "fully_ready" : score >= 68 ? "ready_with_limits" : score >= 52 ? "gradual_return_recommended" : score >= 35 ? "more_recovery_recommended" : "not_ready_for_demanding_activity";
  return { score: Math.round(score), state, severeRestriction: demanding && (state === "not_ready_for_demanding_activity" || burnout >= 85), recommendation: state === "fully_ready" ? "Resume normal workload gradually." : state === "ready_with_limits" ? "Add buffers between commitments." : "Schedule light practice, professional review and rest before demanding work." };
}

export function buildRecommendedItinerary(type: TimeAwayType, focus: RecoveryFocus, days: number) {
  const config = TIME_AWAY_TYPES[type];
  const core = focus === "fitness" ? ["sleep", "healthy_meals", "exercise", "quiet_time"] : focus === "creative_reset" ? ["sleep", "walking", "quiet_time", "light_songwriting"] : focus === "relationship_time" ? ["sleep", "relationship_activities", "relaxation", "social_activities"] : ["sleep", "relaxation", "walking", "healthy_meals"];
  return Array.from({ length: Math.max(0, Math.min(days, config.maxDays)) }, (_, i) => ({ day: i + 1, activities: [...new Set([...core, ...config.allowedActivities.slice(0, 2)])].slice(0, 5), mode: config.allowedItineraryModes[0], scheduledRewardsDirectly: false }));
}
