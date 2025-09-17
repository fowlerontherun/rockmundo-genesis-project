import { meetsRequirements } from "@/utils/gameBalance";
import type { SkillProgressRow, UnlockedSkillsMap } from "@/hooks/useGameData";

export interface TourRequirementPayload {
  fame: number | string;
  skills?: Record<string, number | string | null | undefined>;
  unlockedSkills?: UnlockedSkillsMap;
  skillProgress?: SkillProgressRow[];
}

export interface TourRequirementCheckResult {
  meets: boolean;
  missing: string[];
  performanceUnlocked: boolean;
  normalizedStats: Record<string, number>;
}

const PERFORMANCE_SKILL_SLUG = "performance";

const isPerformanceUnlocked = (
  unlockedSkills?: UnlockedSkillsMap,
  skillProgress?: SkillProgressRow[]
) => {
  if (unlockedSkills && unlockedSkills[PERFORMANCE_SKILL_SLUG]) {
    return true;
  }

  if (!skillProgress || skillProgress.length === 0) {
    return false;
  }

  return skillProgress.some(progress => {
    const slug = progress.skill_slug?.toLowerCase();
    if (slug === PERFORMANCE_SKILL_SLUG) {
      return true;
    }

    return false;
  });
};

const resolveStatValue = (value: number | string | null | undefined): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  return 0;
};

export const checkTourRequirements = (
  requirements: Record<string, number>,
  payload: TourRequirementPayload
): TourRequirementCheckResult => {
  const performanceUnlocked = isPerformanceUnlocked(
    payload.unlockedSkills,
    payload.skillProgress
  );

  const normalizedStats: Record<string, number> = {};

  for (const [requirement] of Object.entries(requirements)) {
    if (requirement === "fame") {
      normalizedStats.fame = resolveStatValue(payload.fame);
      continue;
    }

    if (requirement === PERFORMANCE_SKILL_SLUG) {
      const performanceLevel = resolveStatValue(
        payload.skills?.[PERFORMANCE_SKILL_SLUG]
      );
      normalizedStats[PERFORMANCE_SKILL_SLUG] = performanceUnlocked
        ? performanceLevel
        : 0;
      continue;
    }

    normalizedStats[requirement] = resolveStatValue(
      payload.skills?.[requirement]
    );
  }

  const { meets, missing } = meetsRequirements(requirements, normalizedStats);
  const messages = [...missing];

  if (!performanceUnlocked && !messages.includes("Performance skill is locked")) {
    messages.push("Performance skill is locked");
  }

  return {
    meets: meets && performanceUnlocked,
    missing: messages,
    performanceUnlocked,
    normalizedStats,
  };
};

export const __private__ = {
  isPerformanceUnlocked,
  resolveStatValue,
};
