import type { SkillProgressRow } from "@/hooks/useGameData";

export const SKILL_PRACTICE_CONFIG = {
  maxDailySessions: 5,
  durationOptionsHours: [1],
  baseXpReward: 5,
  minimumSkillLevel: 1,
} as const;

export interface SkillDisplayProgress {
  current_level: number;
  xp_into_level: number;
  xp_required_for_next_level: number | null;
  progress_percent: number;
  next_level: number | null;
  is_max_level: boolean;
  is_unlocked: boolean;
  can_practice: boolean;
  lifetime_xp: number | null;
}

const finiteNumber = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

export const clampProgressPercent = (value: unknown): number => {
  const numeric = finiteNumber(value, 0);
  return Math.max(0, Math.min(100, numeric));
};

export const getSkillDisplayProgress = (skill: Partial<SkillProgressRow> & Record<string, unknown>): SkillDisplayProgress => {
  const currentLevel = Math.max(0, Math.floor(finiteNumber(skill.current_level, 0)));
  const xpIntoLevel = Math.max(0, Math.floor(finiteNumber(skill.xp_into_level ?? skill.current_xp, 0)));
  const requiredRaw = skill.xp_required_for_next_level ?? skill.required_xp;
  const required = finiteNumber(requiredRaw, 0);
  const isMaxLevel = Boolean(skill.is_max_level) || required <= 0;
  const explicitProgress = skill.progress_percent;
  const progressPercent = explicitProgress !== undefined
    ? clampProgressPercent(explicitProgress)
    : required > 0
      ? clampProgressPercent((xpIntoLevel / required) * 100)
      : 0;
  const isUnlocked = typeof skill.is_unlocked === "boolean" ? skill.is_unlocked : currentLevel > 0;
  const canPractice = typeof skill.can_practice === "boolean"
    ? skill.can_practice
    : isUnlocked && currentLevel >= SKILL_PRACTICE_CONFIG.minimumSkillLevel;
  const lifetime = finiteNumber(skill.lifetime_xp ?? skill.total_xp, NaN);

  return {
    current_level: currentLevel,
    xp_into_level: xpIntoLevel,
    xp_required_for_next_level: required > 0 ? Math.floor(required) : null,
    progress_percent: progressPercent,
    next_level: isMaxLevel ? null : currentLevel + 1,
    is_max_level: isMaxLevel,
    is_unlocked: isUnlocked,
    can_practice: canPractice,
    lifetime_xp: Number.isFinite(lifetime) ? Math.max(0, Math.floor(lifetime)) : null,
  };
};

export const calculateSkillOverviewStats = (skills: Array<Partial<SkillProgressRow> & Record<string, unknown>>) => {
  const display = skills.map(getSkillDisplayProgress);
  const unlocked = display.filter((skill) => skill.is_unlocked);
  const lifetimeXpValues = display.map((skill) => skill.lifetime_xp).filter((value): value is number => value !== null);
  return {
    unlockedCount: unlocked.length,
    averageLevel: unlocked.length ? unlocked.reduce((sum, skill) => sum + skill.current_level, 0) / unlocked.length : 0,
    practiceableCount: display.filter((skill) => skill.can_practice).length,
    lifetimeXp: lifetimeXpValues.length === display.length ? lifetimeXpValues.reduce((sum, value) => sum + value, 0) : null,
    currentLevelXp: display.reduce((sum, skill) => sum + skill.xp_into_level, 0),
  };
};
