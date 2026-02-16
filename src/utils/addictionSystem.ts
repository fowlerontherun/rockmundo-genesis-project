import type { BehaviorSettings } from "@/hooks/useBehaviorSettings";

export type AddictionType = "alcohol" | "substances" | "gambling" | "partying";
export type AddictionStatus = "active" | "recovering" | "recovered" | "relapsed";
export type RecoveryProgram = "therapy" | "rehab" | "cold_turkey";

export interface AddictionRecord {
  id: string;
  user_id: string;
  addiction_type: AddictionType;
  severity: number;
  status: AddictionStatus;
  triggered_at: string;
  recovery_started_at: string | null;
  recovered_at: string | null;
  recovery_program: RecoveryProgram | null;
  days_clean: number;
  relapse_count: number;
  created_at: string;
  updated_at: string;
}

// Trigger chance per nightlife event based on partying intensity
const TRIGGER_CHANCES: Record<string, number> = {
  legendary: 0.05,
  heavy: 0.025,
  moderate: 0.006,
  light: 0.001,
  abstinent: 0,
};

export function calculateAddictionTriggerChance(settings: Partial<BehaviorSettings>): number {
  const base = TRIGGER_CHANCES[settings.partying_intensity || "moderate"] || 0.01;
  const multiplier = settings.afterparty_attendance === "always" ? 1.6 : settings.afterparty_attendance === "sometimes" ? 1.2 : 1;
  return base * multiplier;
}

export function rollForAddiction(settings: Partial<BehaviorSettings>): { triggered: boolean; type: AddictionType } {
  const chance = calculateAddictionTriggerChance(settings);
  const triggered = Math.random() < chance;
  // Weighted random type selection
  const types: AddictionType[] = ["alcohol", "alcohol", "substances", "partying", "gambling"];
  const type = types[Math.floor(Math.random() * types.length)];
  return { triggered, type };
}

export function getAddictionEffects(severity: number) {
  return {
    healthRecoveryReduction: Math.round(severity / 4),   // % reduction in health recovery
    maxEnergyCap: Math.round(100 - severity / 2),         // max energy capped
    xpReduction: Math.round(severity / 5),                // % reduction in XP gains
    scandalRiskBoost: Math.round(severity / 3),           // % increase in scandal risk
  };
}

export function getRecoveryProgramDetails(program: RecoveryProgram) {
  switch (program) {
    case "therapy":
      return {
        label: "Therapy",
        costPerSession: 100,
        sessionsNeeded: { min: 5, max: 10 },
        severityReductionPerSession: { min: 5, max: 10 },
        durationDays: 0, // not blocking
        relapseRisk: 0.03, // 3% daily if days_clean < 30
        description: "Weekly sessions with a counselor. Slow but steady recovery without blocking activities.",
      };
    case "rehab":
      return {
        label: "Rehab",
        costRange: { min: 500, max: 2000 },
        durationDays: { min: 7, max: 14 },
        severityReductionTotal: 80,
        relapseRisk: 0.02, // 2% daily if days_clean < 30
        description: "Full residential program. Blocks all activities but provides the best recovery rate.",
      };
    case "cold_turkey":
      return {
        label: "Cold Turkey",
        cost: 0,
        severityReductionPerDay: 1,
        relapseRisk: 0.10, // 10% daily
        description: "Free but risky. Severity drops slowly and relapse chance is very high.",
      };
  }
}

export function checkRelapse(daysClean: number, program: RecoveryProgram | null, settings: Partial<BehaviorSettings>): boolean {
  if (daysClean >= 30) return false;
  
  const baseRisk = program === "cold_turkey" ? 0.10 : program === "therapy" ? 0.03 : 0.02;
  // Risky behavior settings increase relapse chance
  const behaviorMultiplier = settings.partying_intensity === "legendary" ? 2 : settings.partying_intensity === "heavy" ? 1.5 : 1;
  
  return Math.random() < (baseRisk * behaviorMultiplier);
}

export function getSeverityLabel(severity: number): { label: string; color: string } {
  if (severity <= 20) return { label: "Mild", color: "text-yellow-500" };
  if (severity <= 40) return { label: "Moderate", color: "text-orange-400" };
  if (severity <= 60) return { label: "Serious", color: "text-orange-600" };
  if (severity <= 80) return { label: "Severe", color: "text-red-500" };
  return { label: "Critical", color: "text-red-700" };
}

export function getAddictionTypeLabel(type: AddictionType): string {
  switch (type) {
    case "alcohol": return "Alcohol";
    case "substances": return "Substances";
    case "gambling": return "Gambling";
    case "partying": return "Partying";
  }
}

export function getDaysCleanMilestone(days: number): { label: string; reward: number } | null {
  if (days === 7) return { label: "One Week Clean", reward: 50 };
  if (days === 30) return { label: "One Month Clean", reward: 200 };
  if (days === 90) return { label: "Three Months Clean", reward: 500 };
  if (days === 365) return { label: "One Year Clean!", reward: 2000 };
  return null;
}
