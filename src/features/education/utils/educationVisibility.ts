/** The authoritative server result controls which skill-specific learning is discoverable. */
export const isEducationSkillVisible = (
  slug: string | null | undefined,
  accessBySkill: ReadonlyMap<string, boolean>,
): boolean => !slug || accessBySkill.get(slug) === true;
