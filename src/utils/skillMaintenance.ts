import type { CanonicalSkill, SkillSystemKey } from "./skillCatalogue";

export type MaintenancePolicyKey = "none" | "advanced_light" | "professional_standard" | "mastery_specialist";
export type RecoveryRateKey = "none" | "light" | "standard" | "accelerated";
export type MaintenanceStatus = "Sharp" | "Ready" | "Slightly Rusty" | "Rusty" | "Recovering";
export type QualifyingActivityType = "practice" | "rehearsal" | "recording" | "gig" | "songwriting" | "lesson" | "teaching";

export interface MaintenancePolicy {
  key: MaintenancePolicyKey;
  thresholdLevel: number;
  graceDays: number;
  floor: number;
  firstRustRatePerDay: number;
  laterRustRatePerDay: number;
  longRustRatePerDay: number;
  recoveryRate: number;
  comebackRecoveryMultiplier: number;
  qualifyingActivities: QualifyingActivityType[];
  recalculation: "lazy";
  balanceVersion: string;
}

export interface SkillSharpnessRecord {
  profile_id: string;
  skill_id: string;
  sharpness: number;
  last_qualified_use_at: string | null;
  last_calculated_at: string | null;
  maintenance_policy_key: MaintenancePolicyKey;
  balance_version: string;
}

export interface QualifyingUseInput {
  activityType: QualifyingActivityType;
  completed: boolean;
  attended: boolean;
  relevantRole: boolean;
  durationMinutes: number;
  sourceId: string;
  duplicate?: boolean;
  cancelled?: boolean;
  rewardValue?: number;
}

export const SKILL_MAINTENANCE_BALANCE_VERSION = "skill-maintenance-v1";

export const MAINTENANCE_POLICIES: Record<MaintenancePolicyKey, MaintenancePolicy> = {
  none: { key: "none", thresholdLevel: 101, graceDays: 36500, floor: 100, firstRustRatePerDay: 0, laterRustRatePerDay: 0, longRustRatePerDay: 0, recoveryRate: 1, comebackRecoveryMultiplier: 1, qualifyingActivities: [], recalculation: "lazy", balanceVersion: SKILL_MAINTENANCE_BALANCE_VERSION },
  advanced_light: { key: "advanced_light", thresholdLevel: 60, graceDays: 30, floor: 85, firstRustRatePerDay: 0.05, laterRustRatePerDay: 0.09, longRustRatePerDay: 0.03, recoveryRate: 0.55, comebackRecoveryMultiplier: 1.25, qualifyingActivities: ["practice", "rehearsal", "recording", "gig", "lesson", "teaching"], recalculation: "lazy", balanceVersion: SKILL_MAINTENANCE_BALANCE_VERSION },
  professional_standard: { key: "professional_standard", thresholdLevel: 50, graceDays: 45, floor: 80, firstRustRatePerDay: 0.08, laterRustRatePerDay: 0.12, longRustRatePerDay: 0.04, recoveryRate: 0.6, comebackRecoveryMultiplier: 1.3, qualifyingActivities: ["practice", "rehearsal", "recording", "gig", "songwriting", "lesson", "teaching"], recalculation: "lazy", balanceVersion: SKILL_MAINTENANCE_BALANCE_VERSION },
  mastery_specialist: { key: "mastery_specialist", thresholdLevel: 80, graceDays: 60, floor: 75, firstRustRatePerDay: 0.09, laterRustRatePerDay: 0.14, longRustRatePerDay: 0.05, recoveryRate: 0.65, comebackRecoveryMultiplier: 1.35, qualifyingActivities: ["practice", "rehearsal", "recording", "gig", "songwriting", "lesson", "teaching"], recalculation: "lazy", balanceVersion: SKILL_MAINTENANCE_BALANCE_VERSION },
};

const MS_PER_DAY = 86_400_000;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const parseTime = (value: string | null | undefined, fallback: Date) => {
  const parsed = value ? new Date(value) : fallback;
  return Number.isFinite(parsed.getTime()) ? parsed : fallback;
};

export function selectMaintenancePolicy(skill: CanonicalSkill): MaintenancePolicyKey {
  if (!skill.is_active || skill.is_hidden || skill.is_foundational) return "none";
  if (skill.supports_mastery || skill.tier === "mastery" || skill.skill_type === "mastery") return "mastery_specialist";
  if (skill.tier === "professional" || skill.skill_type === "production" || skill.skill_type === "theory") return "professional_standard";
  if (["instrument", "vocal", "performance", "songwriting", "specialist"].includes(skill.skill_type)) return "advanced_light";
  return "none";
}

export function getMaintenanceMetadata(skill: CanonicalSkill) {
  const key = selectMaintenancePolicy(skill);
  const policy = MAINTENANCE_POLICIES[key];
  return {
    supports_maintenance: key !== "none",
    maintenance_policy_key: key,
    maintenance_threshold_level: policy.thresholdLevel,
    maintenance_grace_days: policy.graceDays,
    maintenance_floor: policy.floor,
    recovery_rate_key: key === "none" ? "none" : key === "advanced_light" ? "light" : key === "professional_standard" ? "standard" : "accelerated" as RecoveryRateKey,
  };
}

export function calculateCurrentSharpness(args: { storedSharpness?: number | null; lastQualifiedUseAt?: string | null; calculatedAt?: string | null; now?: Date; policyKey: MaintenancePolicyKey; roleProtected?: boolean; newlyUnlockedAt?: string | null; }): number {
  const policy = MAINTENANCE_POLICIES[args.policyKey] ?? MAINTENANCE_POLICIES.none;
  if (policy.key === "none") return 100;
  const now = args.now ?? new Date();
  const start = parseTime(args.lastQualifiedUseAt ?? args.newlyUnlockedAt ?? args.calculatedAt, now);
  if (start.getTime() > now.getTime()) return clamp(args.storedSharpness ?? 100, policy.floor, 100);
  const protectedGrace = policy.graceDays + (args.roleProtected ? 15 : 0);
  const inactiveDays = Math.max(0, Math.floor((now.getTime() - start.getTime()) / MS_PER_DAY) - protectedGrace);
  if (inactiveDays <= 0) return clamp(args.storedSharpness ?? 100, policy.floor, 100);
  const first = Math.min(inactiveDays, 30) * policy.firstRustRatePerDay;
  const second = Math.min(Math.max(inactiveDays - 30, 0), 60) * policy.laterRustRatePerDay;
  const long = Math.max(inactiveDays - 90, 0) * policy.longRustRatePerDay;
  const floor = args.roleProtected ? Math.min(100, policy.floor + 5) : policy.floor;
  return Math.round(clamp(100 - first - second - long, floor, 100) * 10) / 10;
}

export function getSharpnessModifier(sharpness: number): number {
  const bounded = clamp(sharpness, 0, 100);
  return Math.round((1 - Math.pow((100 - bounded) / 100, 1.15) * 0.2) * 1000) / 1000;
}

export function applySharpnessToSkillContribution(contribution: number, sharpness: number, supportsMaintenance = true): number {
  if (!supportsMaintenance) return contribution;
  return Math.round(contribution * getSharpnessModifier(sharpness) * 100) / 100;
}

export function getMaintenanceStatus(sharpness: number, inGrace = false, recovering = false): MaintenanceStatus {
  if (recovering && sharpness < 100) return "Recovering";
  if (sharpness >= 98) return "Sharp";
  if (inGrace || sharpness >= 90) return "Ready";
  if (sharpness >= 75) return "Slightly Rusty";
  return "Rusty";
}

export function isMeaningfulQualifyingUse(input: QualifyingUseInput, policyKey: MaintenancePolicyKey): boolean {
  const policy = MAINTENANCE_POLICIES[policyKey] ?? MAINTENANCE_POLICIES.none;
  return policy.key !== "none" && policy.qualifyingActivities.includes(input.activityType) && input.completed && input.attended && input.relevantRole && !input.cancelled && !input.duplicate && input.durationMinutes >= 30 && (input.rewardValue ?? 1) > 0 && input.sourceId.trim().length > 0;
}

export function applyRecovery(args: { currentSharpness: number; policyKey: MaintenancePolicyKey; comebackActive?: boolean; sessionMultiplier?: number; }): number {
  const policy = MAINTENANCE_POLICIES[args.policyKey] ?? MAINTENANCE_POLICIES.none;
  const missing = 100 - clamp(args.currentSharpness, policy.floor, 100);
  const multiplier = (args.comebackActive ? policy.comebackRecoveryMultiplier : 1) * (args.sessionMultiplier ?? 1);
  return Math.round(clamp(args.currentSharpness + missing * policy.recoveryRate * multiplier, policy.floor, 100) * 10) / 10;
}

export function isComebackEligible(lastMeaningfulActivityAt: string | null | undefined, now = new Date(), triggerDays = 45): boolean {
  if (!lastMeaningfulActivityAt) return false;
  const last = parseTime(lastMeaningfulActivityAt, now);
  if (last.getTime() > now.getTime()) return false;
  return (now.getTime() - last.getTime()) / MS_PER_DAY >= triggerDays;
}

export function mapSystemsToQualifyingActivities(systems: SkillSystemKey[]): QualifyingActivityType[] {
  const set = new Set<QualifyingActivityType>();
  for (const system of systems) {
    if (system === "rehearsal") set.add("rehearsal");
    if (system === "recording") set.add("recording");
    if (system === "live_gig") set.add("gig");
    if (system === "songwriting") set.add("songwriting");
    if (system === "skill_learning" || system === "education") set.add("practice").add("lesson");
    if (system === "teaching") set.add("teaching");
  }
  return Array.from(set);
}
