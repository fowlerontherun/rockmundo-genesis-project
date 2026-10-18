/** Mirrors public.progression_skill_max_level for the deployed production schema.
 * The eight original core skills cap at 100; other definitions default to 20
 * unless their tier_caps.max_level explicitly overrides that value.
 */
const ORIGINAL_CORE_SKILLS = new Set([
  "guitar", "vocals", "drums", "bass",
  "performance", "songwriting", "composition", "technical",
]);
export const getEducationSkillCap = (slug: string, tierCaps: Record<string, unknown> | null | undefined): number => {
  if (ORIGINAL_CORE_SKILLS.has(slug)) return 100;
  const raw = tierCaps?.max_level;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(1, Math.trunc(raw));
  return 20;
};
