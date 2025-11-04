export const MAX_SKILL_LEVEL = 20;

export const clampSkillLevel = (level: number): number =>
  Math.min(Math.max(level, 0), MAX_SKILL_LEVEL);
