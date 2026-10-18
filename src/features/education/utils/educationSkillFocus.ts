/** A chosen skill is a constraint, not a free-text search hint. */
export const matchesEducationSkillFocus = (
  resourceSkill: string | null | undefined,
  focusedSkill: string | null | undefined,
): boolean => !focusedSkill || resourceSkill === focusedSkill;
