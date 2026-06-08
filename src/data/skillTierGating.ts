/**
 * Shared tier-gating helper.
 *
 * Skills are organised into three tiers: Basic → Professional → Mastery.
 * A higher tier accepts XP only after the previous tier has reached
 * `TIER_UNLOCK_LEVEL` (= MAX_SKILL_LEVEL).
 *
 * Slugs follow `<prefix>_<tier>_<topic>` (e.g. `instruments_basic_electric_guitar`).
 */

import { MAX_SKILL_LEVEL } from "./skillConstants";

export const TIER_UNLOCK_LEVEL = MAX_SKILL_LEVEL;

export type SkillTier = "basic" | "professional" | "mastery";

export interface SkillProgressLike {
  skill_slug: string;
  current_level?: number | null;
}

/** Detect the tier from a slug; returns null if the slug doesn't match the convention. */
export function getTier(slug: string): SkillTier | null {
  if (!slug) return null;
  if (slug.includes("_basic_")) return "basic";
  if (slug.includes("_professional_")) return "professional";
  if (slug.includes("_mastery_")) return "mastery";
  return null;
}

/** Returns the slug of the tier that must be maxed before this one unlocks. */
export function getPrerequisiteSlug(slug: string): string | null {
  const tier = getTier(slug);
  if (tier === "professional") return slug.replace("_professional_", "_basic_");
  if (tier === "mastery") return slug.replace("_mastery_", "_professional_");
  return null;
}

/** Returns true if the slug's tier is unlocked given the player's progress. */
export function isTierUnlocked(
  slug: string,
  progress: ReadonlyArray<SkillProgressLike> | null | undefined,
): boolean {
  const prereq = getPrerequisiteSlug(slug);
  if (!prereq) return true;
  const entry = progress?.find((p) => p.skill_slug === prereq);
  return (entry?.current_level ?? 0) >= TIER_UNLOCK_LEVEL;
}

/** Friendly label for messaging when locked. */
export function getLockReason(slug: string): string | null {
  const prereq = getPrerequisiteSlug(slug);
  if (!prereq) return null;
  return `Max the lower tier (${prereq}) to level ${TIER_UNLOCK_LEVEL} before training this skill.`;
}
