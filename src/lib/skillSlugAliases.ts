export interface SkillProgressLevelLike {
  skill_slug: string;
  current_level?: number | null;
}

const CANONICAL_GENRE_LEGACY_OVERRIDES: Readonly<Record<string, string>> = {
  genres_basic_r_and_b: "basic_rnb",
  genres_basic_lo_fi_hip_hop: "basic_lofi_hip_hop",
  genres_basic_k_pop_j_pop: "basic_kpop_jpop",
  genres_basic_alt_r_and_b_neo_soul: "basic_alt_rnb_neo_soul",
  genres_professional_r_and_b: "professional_rnb",
  genres_professional_lo_fi_hip_hop: "professional_lofi_hip_hop",
  genres_professional_k_pop_j_pop: "professional_kpop_jpop",
  genres_professional_alt_r_and_b_neo_soul: "professional_alt_rnb_neo_soul",
  genres_mastery_r_and_b: "rnb_mastery",
  genres_mastery_lo_fi_hip_hop: "lofi_hip_hop_mastery",
  genres_mastery_k_pop_j_pop: "kpop_jpop_mastery",
  genres_mastery_alt_r_and_b_neo_soul: "alt_rnb_neo_soul_mastery",
};

/**
 * Return the currently supported aliases for a canonical genre skill.
 *
 * The canonical skill tree uses `genres_<tier>_<genre>`, while older
 * university courses wrote progress to slugs such as `basic_punk_rock`.
 * Keeping the alias resolution in one place lets old characters retain their
 * earned levels while the database is migrated to canonical slugs.
 */
export function getEquivalentSkillSlugs(skillSlug: string): string[] {
  const slugs = new Set<string>([skillSlug]);
  const override = CANONICAL_GENRE_LEGACY_OVERRIDES[skillSlug];

  if (skillSlug.startsWith("genres_basic_")) {
    slugs.add(`basic_${skillSlug.slice("genres_basic_".length)}`);
  } else if (skillSlug.startsWith("genres_professional_")) {
    slugs.add(`professional_${skillSlug.slice("genres_professional_".length)}`);
  } else if (skillSlug.startsWith("genres_mastery_")) {
    slugs.add(`${skillSlug.slice("genres_mastery_".length)}_mastery`);
  }

  if (override) slugs.add(override);
  return [...slugs];
}

export function getEquivalentSkillLevel(
  progress: ReadonlyArray<SkillProgressLevelLike> | null | undefined,
  skillSlug: string,
): number {
  const aliases = new Set(getEquivalentSkillSlugs(skillSlug));

  return (progress ?? []).reduce((highest, entry) => {
    if (!aliases.has(entry.skill_slug)) return highest;
    const level = Number(entry.current_level ?? 0);
    return Number.isFinite(level) ? Math.max(highest, level) : highest;
  }, 0);
}
