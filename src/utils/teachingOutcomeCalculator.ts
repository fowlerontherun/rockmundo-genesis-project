import { CANONICAL_SKILLS, type CanonicalSkill } from "./skillCatalogue";
import { getDiminishingAttributeEffect, getXpRequiredForNextLevel, PROGRESSION_BALANCE, PROGRESSION_BALANCE_VERSION } from "./progressionBalance";
import { calculateMasteryRewardXp, getTotalDirectMasteryAdvantage, type SpecialisationEffect } from "./mastery";
import { getMaintenanceMetadata, MAINTENANCE_POLICIES } from "./skillMaintenance";

export const TEACHING_BALANCE_VERSION = "player_teaching_v1.0.0";

export type TeachingSessionType = "one_off_lesson" | "mentoring_session" | "bandmate_coaching" | "group_workshop" | "professional_coaching" | "rehearsal_linked_coaching";
export type TeachingPolicyKey = "foundation_lesson" | "standard_skill_lesson" | "advanced_specialist_lesson" | "mastery_coaching" | "bandmate_coaching" | "group_workshop";

export interface TeachingPolicy { key: TeachingPolicyKey; minimumTeacherLevel: number; requiredTeachingLevel: number; maximumStudents: number; baseDurationMinutes: number; xpRange: readonly [number, number]; teacherAdvantageRequired: number; repetitionPenalty: readonly number[]; rollingWindowDays: number; cooldownHours: number; priceLimits: readonly [number, number]; requiresMasteryRank?: number; maintenanceCredit: number; teacherTeachingXpRange: readonly [number, number]; studentEffectivenessScalar: number; teacherRewardCap: number; }

export const TEACHING_POLICIES: Record<TeachingPolicyKey, TeachingPolicy> = {
  foundation_lesson: { key: "foundation_lesson", minimumTeacherLevel: 8, requiredTeachingLevel: 1, maximumStudents: 1, baseDurationMinutes: 60, xpRange: [90, 180], teacherAdvantageRequired: 2, repetitionPenalty: [1, 0.85, 0.65, 0.45], rollingWindowDays: 14, cooldownHours: 18, priceLimits: [25, 250], maintenanceCredit: 0.12, teacherTeachingXpRange: [18, 42], studentEffectivenessScalar: 1, teacherRewardCap: 70 },
  standard_skill_lesson: { key: "standard_skill_lesson", minimumTeacherLevel: 18, requiredTeachingLevel: 4, maximumStudents: 1, baseDurationMinutes: 90, xpRange: [130, 260], teacherAdvantageRequired: 3, repetitionPenalty: [1, 0.8, 0.58, 0.38], rollingWindowDays: 21, cooldownHours: 24, priceLimits: [75, 700], maintenanceCredit: 0.1, teacherTeachingXpRange: [26, 58], studentEffectivenessScalar: 1.05, teacherRewardCap: 90 },
  advanced_specialist_lesson: { key: "advanced_specialist_lesson", minimumTeacherLevel: 55, requiredTeachingLevel: 12, maximumStudents: 1, baseDurationMinutes: 120, xpRange: [190, 360], teacherAdvantageRequired: 8, repetitionPenalty: [1, 0.78, 0.52, 0.32], rollingWindowDays: 30, cooldownHours: 36, priceLimits: [250, 1800], maintenanceCredit: 0.08, teacherTeachingXpRange: [36, 78], studentEffectivenessScalar: 1.1, teacherRewardCap: 120 },
  mastery_coaching: { key: "mastery_coaching", minimumTeacherLevel: 80, requiredTeachingLevel: 18, maximumStudents: 1, baseDurationMinutes: 120, xpRange: [220, 420], teacherAdvantageRequired: 10, repetitionPenalty: [1, 0.75, 0.5, 0.3], rollingWindowDays: 30, cooldownHours: 48, priceLimits: [500, 3000], requiresMasteryRank: 1, maintenanceCredit: 0.08, teacherTeachingXpRange: [42, 90], studentEffectivenessScalar: 1.12, teacherRewardCap: 135 },
  bandmate_coaching: { key: "bandmate_coaching", minimumTeacherLevel: 12, requiredTeachingLevel: 1, maximumStudents: 1, baseDurationMinutes: 60, xpRange: [45, 110], teacherAdvantageRequired: 2, repetitionPenalty: [1, 0.75, 0.5, 0.25], rollingWindowDays: 14, cooldownHours: 12, priceLimits: [0, 200], maintenanceCredit: 0.05, teacherTeachingXpRange: [10, 28], studentEffectivenessScalar: 0.72, teacherRewardCap: 40 },
  group_workshop: { key: "group_workshop", minimumTeacherLevel: 30, requiredTeachingLevel: 8, maximumStudents: 5, baseDurationMinutes: 120, xpRange: [80, 190], teacherAdvantageRequired: 5, repetitionPenalty: [1, 0.8, 0.55, 0.35], rollingWindowDays: 21, cooldownHours: 36, priceLimits: [40, 600], maintenanceCredit: 0.06, teacherTeachingXpRange: [20, 55], studentEffectivenessScalar: 0.78, teacherRewardCap: 140 },
};

export interface TeachingMetadata { is_teachable: boolean; minimum_teacher_level: number; minimum_teacher_advantage: number; teaching_policy_key: TeachingPolicyKey; supports_group_workshop: boolean; supports_band_coaching: boolean; supports_mentoring: boolean; }
export type TeachableSkill = CanonicalSkill & TeachingMetadata;

export function getTeachingMetadata(skill: CanonicalSkill): TeachingMetadata {
  if (!skill.is_active || skill.is_hidden || skill.skill_type === "mastery") return { is_teachable: false, minimum_teacher_level: 999, minimum_teacher_advantage: 999, teaching_policy_key: "standard_skill_lesson", supports_group_workshop: false, supports_band_coaching: false, supports_mentoring: false };
  const policy: TeachingPolicyKey = skill.is_foundational || skill.tier === "basic" ? "foundation_lesson" : skill.tier === "mastery" ? "mastery_coaching" : ["production", "specialist"].includes(skill.skill_type) ? "advanced_specialist_lesson" : "standard_skill_lesson";
  const p = TEACHING_POLICIES[policy];
  const workshop = ["foundation", "instrument", "vocal", "performance", "songwriting", "theory", "production", "business", "social", "teaching"].includes(skill.skill_type);
  return { is_teachable: true, minimum_teacher_level: p.minimumTeacherLevel, minimum_teacher_advantage: p.teacherAdvantageRequired, teaching_policy_key: policy, supports_group_workshop: workshop, supports_band_coaching: ["instrument", "vocal", "performance", "songwriting", "theory", "production"].includes(skill.skill_type), supports_mentoring: !["health", "craft"].includes(skill.skill_type) };
}
export const TEACHABLE_SKILLS: TeachableSkill[] = CANONICAL_SKILLS.map((skill) => ({ ...skill, ...getTeachingMetadata(skill) }));

export interface TeachingCalculatorInput { teacherProfileId: string; studentProfileId: string; skillId: string; sessionType: TeachingSessionType; durationMinutes: number; price: number; balanceVersion?: string; mentoringRelationshipId?: string | null; scheduledActivityId?: string | null; studentCount?: number; }
export interface TeachingCalculatorState { teacherSkillLevel: number; studentSkillLevel: number; teachingSkillLevel: number; teacherAttributes?: Partial<Record<"mental_focus" | "charisma", number>>; studentLearningModifier?: number; masteryRank?: number; masteryEffects?: SpecialisationEffect[]; priorPairSessions?: number; relationshipModifier?: number; isBandmate?: boolean; studentLifetimeXp?: number; teacherRestricted?: boolean; teacherAvailable?: boolean; studentAvailable?: boolean; paymentReserved?: boolean; activityCompleted?: boolean; }
export interface TeachingOutcome { policy: TeachingPolicy; skill: TeachableSkill; eligible: boolean; blockedReasons: string[]; teachingQuality: number; teachingQualityBand: "low" | "solid" | "strong" | "elite"; studentTargetXp: number; teacherTeachingXp: number; teacherMaintenanceCredit: number; masteryXp: number; repetitionModifier: number; price: number; balanceVersion: string; progressionBalanceVersion: string; telemetryEvents: string[]; }

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));
const lerp = ([min, max]: readonly [number, number], t: number) => min + (max - min) * clamp(t, 0, 1);

export function calculateTeachingOutcome(input: TeachingCalculatorInput, state: TeachingCalculatorState): TeachingOutcome {
  const skill = TEACHABLE_SKILLS.find((s) => s.slug === input.skillId || s.id === input.skillId);
  const fallback = TEACHABLE_SKILLS[0];
  const resolvedSkill = skill ?? fallback;
  const policy = TEACHING_POLICIES[input.sessionType === "group_workshop" ? "group_workshop" : input.sessionType === "bandmate_coaching" || input.sessionType === "rehearsal_linked_coaching" ? "bandmate_coaching" : input.sessionType === "professional_coaching" ? "advanced_specialist_lesson" : resolvedSkill.teaching_policy_key];
  const blockedReasons: string[] = [];
  if (!skill || !resolvedSkill.is_teachable) blockedReasons.push("skill_not_teachable");
  if (input.teacherProfileId === input.studentProfileId) blockedReasons.push("self_teaching_blocked");
  if (input.balanceVersion && input.balanceVersion !== TEACHING_BALANCE_VERSION) blockedReasons.push("balance_version_mismatch");
  if ((state.teacherAvailable ?? true) === false || (state.studentAvailable ?? true) === false) blockedReasons.push("participant_unavailable");
  if ((state.teacherRestricted ?? false) === true) blockedReasons.push("teacher_restricted");
  if ((state.paymentReserved ?? true) === false) blockedReasons.push("payment_not_reserved");
  if ((state.activityCompleted ?? true) === false) blockedReasons.push("activity_not_completed");
  if (input.durationMinutes < 30 || input.durationMinutes > 240) blockedReasons.push("invalid_duration");
  const studentCount = input.studentCount ?? 1;
  if (studentCount < 1 || studentCount > policy.maximumStudents) blockedReasons.push("student_capacity_exceeded");
  if (input.price < policy.priceLimits[0] || input.price > policy.priceLimits[1]) blockedReasons.push("price_out_of_bounds");
  const advantage = state.teacherSkillLevel - state.studentSkillLevel;
  if (state.teacherSkillLevel < Math.max(policy.minimumTeacherLevel, resolvedSkill.minimum_teacher_level)) blockedReasons.push("teacher_level_too_low");
  if (advantage < Math.max(policy.teacherAdvantageRequired, resolvedSkill.minimum_teacher_advantage)) blockedReasons.push("insufficient_teacher_advantage");
  if (state.teachingSkillLevel < policy.requiredTeachingLevel) blockedReasons.push("teaching_skill_too_low");
  if (policy.requiresMasteryRank && (state.masteryRank ?? 0) < policy.requiresMasteryRank) blockedReasons.push("mastery_required");
  if ((input.sessionType === "bandmate_coaching" || input.sessionType === "rehearsal_linked_coaching") && !state.isBandmate) blockedReasons.push("band_membership_required");

  const advantageScore = getDiminishingAttributeEffect(Math.max(0, advantage) * 90) / getDiminishingAttributeEffect(1000);
  const teachingScore = getDiminishingAttributeEffect(state.teachingSkillLevel * 55) / getDiminishingAttributeEffect(1000);
  const masteryScore = Math.min(1, (state.masteryRank ?? 0) / 4 + getTotalDirectMasteryAdvantage(state.masteryEffects ?? []));
  const focusScore = getDiminishingAttributeEffect(state.teacherAttributes?.mental_focus ?? 0) / getDiminishingAttributeEffect(1000);
  const charismaScore = getDiminishingAttributeEffect(state.teacherAttributes?.charisma ?? 0) / getDiminishingAttributeEffect(1000);
  const relationship = clamp(state.relationshipModifier ?? 1, 0.9, 1.08);
  const rawQuality = (0.42 * advantageScore + 0.25 * teachingScore + 0.13 * masteryScore + 0.12 * focusScore + 0.08 * charismaScore) * relationship;
  const teachingQuality = clamp(rawQuality, 0.2, 1.15);
  const repetitionModifier = policy.repetitionPenalty[Math.min(policy.repetitionPenalty.length - 1, Math.max(0, state.priorPairSessions ?? 0))];
  const durationModifier = clamp(input.durationMinutes / policy.baseDurationMinutes, 0.5, 1.5);
  const maxLevel = resolvedSkill.max_level ?? 100;
  const difficultyModifier = state.studentSkillLevel >= maxLevel ? 0 : clamp(1 - state.studentSkillLevel / (maxLevel * 1.8), 0.55, 1.05);
  const qualityModifier = clamp(0.75 + teachingQuality * 0.65, 0.75, 1.45);
  const baseXp = lerp(policy.xpRange, teachingQuality) * policy.studentEffectivenessScalar;
  let studentTargetXp = Math.floor(baseXp * qualityModifier * clamp(state.studentLearningModifier ?? 1, 0.75, 1.35) * durationModifier * difficultyModifier * repetitionModifier * relationship);
  const nextLevelCap = getXpRequiredForNextLevel(resolvedSkill, state.studentSkillLevel);
  if (state.studentSkillLevel >= maxLevel || nextLevelCap === 0) studentTargetXp = 0;
  else studentTargetXp = Math.min(studentTargetXp, Math.max(nextLevelCap, Math.ceil(nextLevelCap * 0.45)));
  const teacherTeachingXp = Math.min(policy.teacherRewardCap, Math.floor(lerp(policy.teacherTeachingXpRange, teachingQuality) * durationModifier * Math.max(0.35, repetitionModifier)));
  const maintenance = getMaintenanceMetadata(resolvedSkill);
  const maintenanceAllowed = maintenance.supports_maintenance && MAINTENANCE_POLICIES[maintenance.maintenance_policy_key].qualifyingActivities.includes("teaching");
  const teacherMaintenanceCredit = maintenanceAllowed ? Number((policy.maintenanceCredit * repetitionModifier).toFixed(3)) : 0;
  const masteryXp = policy.requiresMasteryRank ? calculateMasteryRewardXp({ profileId: input.teacherProfileId, skillId: resolvedSkill.slug, specialisationId: `${resolvedSkill.slug}_teaching`, source: "teaching", sourceRecordId: input.scheduledActivityId ?? "preview", baseXp: 35, difficulty: difficultyModifier, quality: teachingQuality, durationMinutes: input.durationMinutes, repetitionCount: state.priorPairSessions ?? 0, idempotencyKey: `${input.scheduledActivityId ?? "preview"}:${input.teacherProfileId}:${input.studentProfileId}:${resolvedSkill.slug}` }) : 0;
  return { policy, skill: resolvedSkill, eligible: blockedReasons.length === 0, blockedReasons, teachingQuality: Number(teachingQuality.toFixed(3)), teachingQualityBand: teachingQuality >= 0.9 ? "elite" : teachingQuality >= 0.68 ? "strong" : teachingQuality >= 0.45 ? "solid" : "low", studentTargetXp, teacherTeachingXp, teacherMaintenanceCredit, masteryXp, repetitionModifier, price: input.price, balanceVersion: TEACHING_BALANCE_VERSION, progressionBalanceVersion: PROGRESSION_BALANCE.version ?? PROGRESSION_BALANCE_VERSION, telemetryEvents: ["lesson_preview", ...(repetitionModifier < 1 ? ["repetition_penalty_applied"] : [])] };
}
