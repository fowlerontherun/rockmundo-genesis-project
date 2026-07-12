import { calculateCareerSustainability, type WorkloadSummary } from "@/lib/timeAwayWellness";
import type { WellnessCoreValues } from "@/lib/wellnessSystem";

export type CareerStage = "emerging" | "developing" | "established" | "veteran" | "legacy";
export type CareerResilienceState = "fragile" | "recovering" | "stable" | "resilient" | "highly_resilient";
export type CareerMode = "full_time_performer" | "selective_touring" | "studio_focused" | "festival_focused" | "local_performer" | "session_musician" | "songwriter_focused" | "mentor_educator" | "semi_retired" | "retired";
export type RetirementState = "active" | "selective" | "semi_retired" | "retired_from_touring" | "retired_from_performance" | "fully_retired" | "returning";
export type RetirementScope = "touring" | "live_performance" | "active_band_membership" | "all_professional_music";
export type ComebackReadinessState = "ready" | "ready_with_preparation" | "gradual_return_advised" | "significant_preparation_required" | "not_ready_for_demanding_return";
export type MentoringFocus = "instrument_technique" | "vocal_technique" | "songwriting" | "performance" | "production" | "business" | "touring" | "leadership" | "wellness_routines";
export type LegacyState = "recognised" | "respected" | "influential" | "iconic" | "legendary";

export interface CareerHistoryInput {
  biologicalAge?: number | null;
  careerStartDate?: string | null;
  asOfDate?: string;
  firstBandJoinedAt?: string | null;
  firstGigAt?: string | null;
  firstReleaseAt?: string | null;
  firstContractAt?: string | null;
  gigCount?: number;
  tourCount?: number;
  releaseCount?: number;
  recordingHours?: number;
  rehearsalHours?: number;
  awards?: number;
  leadershipMonths?: number;
  teachingSessions?: number;
  comebackCount?: number;
  majorMilestones?: number;
  fame?: number;
  skillAverage?: number;
  activeMonthsOverride?: number;
  retiredMonths?: number;
  inactiveMonths?: number;
}

export interface CareerWearInput extends WorkloadSummary {
  cumulativeTourLoad?: number;
  cumulativePerformanceLoad?: number;
  cumulativeRecordingLoad?: number;
  cumulativeRehearsalLoad?: number;
  cumulativeTravelLoad?: number;
  cumulativeBurnoutExposure?: number;
  cumulativeConditionDays?: number;
  cumulativeRecoveryDays?: number;
}

export const CAREER_LONGEVITY_BALANCE = {
  stageThresholds: {
    developing: { activeYears: 1, experience: 18, activities: 12 },
    established: { activeYears: 3, experience: 38, activities: 45 },
    veteran: { activeYears: 8, experience: 62, activities: 120 },
    legacy: { activeYears: 15, experience: 84, activities: 260 },
  },
  ageModifiers: {
    beginsAtAge: 40,
    fullAtAge: 68,
    maxRecoveryReduction: 0.18,
    maxStrainRiskIncrease: 0.14,
    maxConsecutiveToleranceReduction: 0.12,
  },
  veteranBonusCaps: {
    performanceConsistency: 0.12,
    mistakeSeverityReduction: 0.1,
    rehearsalEfficiency: 0.1,
    recordingConsistency: 0.09,
    stressResilience: 0.08,
    mentoringEfficiency: 0.14,
  },
  comeback: { minimumRewardRetirementDays: 30, maxMomentumRestore: 28 },
  mentoring: { dailySessionCap: 2, weeklyPairCap: 3, maxLearningEfficiency: 0.12, noShowReward: 0 },
  legacyThresholds: { recognised: 20, respected: 38, influential: 58, iconic: 78, legendary: 92 },
} as const;

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0));
const monthsBetween = (start?: string | null, end = new Date().toISOString().slice(0, 10)) => {
  if (!start) return 0;
  const s = Date.parse(start);
  const e = Date.parse(end);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return 0;
  return Math.floor((e - s) / 2629800000);
};

export function resolveCareerStart(input: CareerHistoryInput): string | null {
  return [input.careerStartDate, input.firstBandJoinedAt, input.firstGigAt, input.firstReleaseAt, input.firstContractAt]
    .filter((v): v is string => Boolean(v))
    .sort()[0] ?? null;
}

export function calculateCareerAge(input: CareerHistoryInput) {
  const activeMonths = input.activeMonthsOverride ?? Math.max(0, monthsBetween(resolveCareerStart(input), input.asOfDate) - (input.retiredMonths ?? 0) - Math.floor((input.inactiveMonths ?? 0) * 0.5));
  return { careerStartDate: resolveCareerStart(input), activeCareerYears: Number((activeMonths / 12).toFixed(1)), touringYears: Number(((input.tourCount ?? 0) / 8).toFixed(1)), retiredYears: Number(((input.retiredMonths ?? 0) / 12).toFixed(1)), inactiveYears: Number(((input.inactiveMonths ?? 0) / 12).toFixed(1)) };
}

export function calculateExperienceScore(input: CareerHistoryInput) {
  const age = calculateCareerAge(input);
  const score =
    age.activeCareerYears * 4 +
    Math.min(22, (input.gigCount ?? 0) * 0.18) +
    Math.min(12, (input.tourCount ?? 0) * 1.4) +
    Math.min(10, (input.releaseCount ?? 0) * 1.2) +
    Math.min(9, (input.recordingHours ?? 0) * 0.035) +
    Math.min(7, (input.rehearsalHours ?? 0) * 0.015) +
    Math.min(8, (input.awards ?? 0) * 1.5) +
    Math.min(6, (input.leadershipMonths ?? 0) * 0.12) +
    Math.min(6, (input.teachingSessions ?? 0) * 0.08) +
    Math.min(5, (input.comebackCount ?? 0) * 1.3) +
    Math.min(6, (input.majorMilestones ?? 0) * 0.8) +
    Math.min(5, Math.log10(Math.max(1, input.fame ?? 0)) * 1.4) +
    Math.min(4, (input.skillAverage ?? 0) * 0.04);
  return Math.round(clamp(score));
}

export function resolveCareerStage(input: CareerHistoryInput): CareerStage {
  const activeYears = calculateCareerAge(input).activeCareerYears;
  const experience = calculateExperienceScore(input);
  const activities = (input.gigCount ?? 0) + (input.tourCount ?? 0) * 6 + (input.releaseCount ?? 0) * 4 + (input.majorMilestones ?? 0) * 3;
  const t = CAREER_LONGEVITY_BALANCE.stageThresholds;
  if (activeYears >= t.legacy.activeYears && experience >= t.legacy.experience && activities >= t.legacy.activities) return "legacy";
  if (activeYears >= t.veteran.activeYears && experience >= t.veteran.experience && activities >= t.veteran.activities) return "veteran";
  if (activeYears >= t.established.activeYears && experience >= t.established.experience && activities >= t.established.activities) return "established";
  if (activeYears >= t.developing.activeYears || experience >= t.developing.experience || activities >= t.developing.activities) return "developing";
  return "emerging";
}

export function calculateAgeModifiers(biologicalAge = 16, offsets: { fitness?: number; professionalSupport?: number; preparation?: number } = {}) {
  const cfg = CAREER_LONGEVITY_BALANCE.ageModifiers;
  const progress = clamp((biologicalAge - cfg.beginsAtAge) / (cfg.fullAtAge - cfg.beginsAtAge), 0, 1);
  const offset = clamp((offsets.fitness ?? 0) * 0.004 + (offsets.professionalSupport ?? 0) * 0.003 + (offsets.preparation ?? 0) * 0.003, 0, 0.75);
  const effective = progress * (1 - offset);
  return {
    recoverySpeedMultiplier: Number((1 - cfg.maxRecoveryReduction * effective).toFixed(3)),
    strainRiskMultiplier: Number((1 + cfg.maxStrainRiskIncrease * effective).toFixed(3)),
    consecutiveWorkloadTolerance: Number((1 - cfg.maxConsecutiveToleranceReduction * effective).toFixed(3)),
    capped: true,
    offsetsApplied: offset > 0,
  };
}

export function calculateVeteranAdvantages(input: CareerHistoryInput) {
  const experience = calculateExperienceScore(input);
  const stage = resolveCareerStage(input);
  const factor = stage === "emerging" ? 0 : clamp((experience - 25) / 70, 0, 1);
  const caps = CAREER_LONGEVITY_BALANCE.veteranBonusCaps;
  return Object.fromEntries(Object.entries(caps).map(([k, cap]) => [k, Number((cap * factor).toFixed(3))])) as Record<keyof typeof caps, number>;
}

export function calculateCareerWear(input: CareerWearInput) {
  const recent = calculateCareerSustainability(input);
  const historical = clamp((input.cumulativeTourLoad ?? 0) * 0.02 + (input.cumulativePerformanceLoad ?? 0) * 0.015 + (input.cumulativeRecordingLoad ?? 0) * 0.01 + (input.cumulativeRehearsalLoad ?? 0) * 0.008 + (input.cumulativeTravelLoad ?? 0) * 0.006 + (input.cumulativeBurnoutExposure ?? 0) * 0.04 + (input.cumulativeConditionDays ?? 0) * 0.05 - (input.cumulativeRecoveryDays ?? 0) * 0.025, 0, 100);
  const activeImpact = clamp(historical * 0.45 + recent.score * 0.55 - input.restDays * 2 - input.holidays * 3, 0, 100);
  return { historicalTotal: Math.round(historical), activeImpact: Math.round(activeImpact), longTermWorkloadBalance: Math.round(clamp(100 - activeImpact)), sustainability: recent.state, recommendation: activeImpact >= 70 ? "Add recovery windows before demanding tours." : activeImpact >= 45 ? "Keep buffers between intense commitments." : "Current long-term load is sustainable." };
}

export function calculateCareerResilience(input: { vitals: Partial<WellnessCoreValues>; history: CareerHistoryInput; wear: ReturnType<typeof calculateCareerWear>; professionalSupport?: number; lifestyleStability?: number }) {
  const v = input.vitals;
  const score = clamp((v.fitness ?? 50) * 0.18 + (v.energy ?? 70) * 0.12 + (v.sleep_quality ?? 70) * 0.14 + (100 - (v.stress ?? 30)) * 0.1 + (100 - (v.fatigue ?? 35)) * 0.12 + (100 - (v.burnout_risk ?? 18)) * 0.16 + calculateExperienceScore(input.history) * 0.1 + (input.professionalSupport ?? 0) * 0.08 + (input.lifestyleStability ?? 55) * 0.08 - input.wear.activeImpact * 0.08);
  const state: CareerResilienceState = score >= 84 ? "highly_resilient" : score >= 68 ? "resilient" : score >= 48 ? "stable" : score >= 30 ? "recovering" : "fragile";
  return { score: Math.round(score), state };
}

export function calculateComebackReadiness(input: { retirementState: RetirementState; daysAway: number; vitals: Partial<WellnessCoreValues>; history: CareerHistoryInput; preparationScore: number; wear: ReturnType<typeof calculateCareerWear>; bandAvailable?: boolean }) {
  const resilience = calculateCareerResilience({ vitals: input.vitals, history: input.history, wear: input.wear }).score;
  const awayPenalty = Math.min(24, input.daysAway / 18);
  const score = clamp(resilience * 0.45 + input.preparationScore * 0.32 + calculateExperienceScore(input.history) * 0.18 + (input.bandAvailable === false ? -10 : 4) - awayPenalty - input.wear.activeImpact * 0.08);
  const state: ComebackReadinessState = score >= 82 ? "ready" : score >= 66 ? "ready_with_preparation" : score >= 50 ? "gradual_return_advised" : score >= 34 ? "significant_preparation_required" : "not_ready_for_demanding_return";
  return { score: Math.round(score), state, rewardEligible: input.daysAway >= CAREER_LONGEVITY_BALANCE.comeback.minimumRewardRetirementDays, recommendation: state === "ready" ? "Normal return is viable with scheduled rest." : "Use rehearsals, wellness support and warm-up events before demanding commitments." };
}

export function validateMentoringEligibility(input: { mentor: CareerHistoryInput; menteeProfileId: string; mentorProfileId: string; focus: MentoringFocus; mentorRelevantSkill: number; activeBurnout?: number; scheduleConflict?: boolean }) {
  const stage = resolveCareerStage(input.mentor);
  const eligible = input.menteeProfileId !== input.mentorProfileId && ["established", "veteran", "legacy"].includes(stage) && calculateExperienceScore(input.mentor) >= 38 && input.mentorRelevantSkill >= 55 && (input.activeBurnout ?? 0) < 82 && !input.scheduleConflict;
  return { eligible, reasons: [input.menteeProfileId === input.mentorProfileId && "Self-mentoring is not allowed.", !["established", "veteran", "legacy"].includes(stage) && "Mentor must be established or later.", input.mentorRelevantSkill < 55 && "Relevant skill is too low for this focus.", (input.activeBurnout ?? 0) >= 82 && "Severe burnout blocks mentoring rewards.", input.scheduleConflict && "Schedule conflict must be resolved."].filter(Boolean) as string[] };
}

export function calculateLegacyProgression(input: CareerHistoryInput & { mentoringMilestones?: number; bandLeadershipMilestones?: number; communityContribution?: number; companyContribution?: number; reliableYears?: number }) {
  const score = clamp(calculateExperienceScore(input) * 0.45 + (input.awards ?? 0) * 1.2 + (input.mentoringMilestones ?? 0) * 2 + (input.bandLeadershipMilestones ?? 0) * 1.5 + (input.comebackCount ?? 0) * 1.4 + (input.communityContribution ?? 0) * 1.5 + (input.companyContribution ?? 0) + (input.reliableYears ?? 0) * 1.1);
  const t = CAREER_LONGEVITY_BALANCE.legacyThresholds;
  const state: LegacyState = score >= t.legendary ? "legendary" : score >= t.iconic ? "iconic" : score >= t.influential ? "influential" : score >= t.respected ? "respected" : "recognised";
  return { score: Math.round(score), state, hallOfFameEligible: score >= t.iconic && calculateCareerAge(input).activeCareerYears >= 10, powerCreepProtected: true };
}
