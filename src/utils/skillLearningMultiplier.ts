/**
 * Skill Learning Multiplier System
 *
 * Runtime learning speed now uses explicit canonical skill_attribute_links.
 * Regex rules remain only as a development-warning fallback for legacy skills
 * that are missing canonical relationships.
 */

import {
  SKILL_ATTRIBUTE_MAP,
  ATTRIBUTE_MAX_VALUE,
  type FullAttributeKey,
} from "./attributeProgression";
import {
  calculateWeightedLearningMultiplier,
  getSkillAttributeLinks,
  type SkillAttributeLink,
} from "./skillCatalogue";

interface MultiplierRule {
  pattern: RegExp;
  attributes: FullAttributeKey[];
}
export const skillLearningDiagnostics = {
  fallbackSkillSlugs: new Set<string>(),
};

const RULES: MultiplierRule[] = [
  {
    pattern: /(?:^|_)(vocal|singing|rapping|ad_libs)(?:$|_)/,
    attributes: ["vocal_talent", "musicality"],
  },
  {
    pattern:
      /(?:_drums|_percussion|tabla|djembe|bongos|cajon|taiko|snare|timpani|beatmaking)(?:$|_)/,
    attributes: ["rhythm_sense", "musicality"],
  },
  { pattern: /^stage_/, attributes: ["stage_presence", "crowd_engagement"] },
  { pattern: /^audience_/, attributes: ["crowd_engagement", "charisma"] },
  { pattern: /^business_/, attributes: ["social_reach", "charisma"] },
  { pattern: /^health_/, attributes: ["physical_endurance", "mental_focus"] },
  {
    pattern:
      /songwriting_.*_(?:composing|lyrics|record_production|sampling|sound_design|ai_music)/,
    attributes: ["creative_insight", "musicality"],
  },
  {
    pattern: /songwriting_.*_(?:mixing|daw|vocal_processing|beatmaking)/,
    attributes: ["technical_mastery", "creative_insight"],
  },
  { pattern: /^theory_/, attributes: ["musicality", "mental_focus"] },
  { pattern: /^improv_/, attributes: ["creative_insight", "musicality"] },
  { pattern: /^dj_/, attributes: ["rhythm_sense", "crowd_engagement"] },
  { pattern: /^teaching_/, attributes: ["mental_focus", "charisma"] },
  { pattern: /^genres_/, attributes: ["musical_ability", "creative_insight"] },
  { pattern: /^luthiery_/, attributes: ["technical_mastery", "mental_focus"] },
  { pattern: /^modeling_/, attributes: ["charisma", "stage_presence"] },
  { pattern: /^fashion_/, attributes: ["creative_insight", "charisma"] },
  {
    pattern: /^clothing_/,
    attributes: ["creative_insight", "technical_mastery"],
  },
  { pattern: /^instruments_/, attributes: ["musical_ability", "musicality"] },
];

function warnFallback(skillSlug: string) {
  skillLearningDiagnostics.fallbackSkillSlugs.add(skillSlug);
  if (import.meta.env.DEV)
    console.warn(
      `[skill-catalogue] Missing explicit learning_speed attribute links for "${skillSlug}"; using legacy fallback.`,
    );
}

function legacyFallbackLinks(skillSlug: string): SkillAttributeLink[] {
  const matched = RULES.find((rule) =>
    rule.pattern.test(skillSlug),
  )?.attributes;
  const attributes =
    matched ??
    (SKILL_ATTRIBUTE_MAP[skillSlug]
      ? [SKILL_ATTRIBUTE_MAP[skillSlug] as FullAttributeKey]
      : []);
  if (attributes.length === 0) return [];
  warnFallback(skillSlug);
  const weight = 1 / attributes.length;
  return attributes.map((attribute_key, index) => ({
    skill_slug: skillSlug,
    attribute_key,
    relationship_type: "learning_speed",
    weight,
    max_bonus: 0.5,
    is_primary: index === 0,
  }));
}

export function getLearningAttributeLinks(
  skillSlug: string,
): SkillAttributeLink[] {
  const explicit = getSkillAttributeLinks(skillSlug, "learning_speed");
  return explicit.length > 0 ? explicit : legacyFallbackLinks(skillSlug);
}

export function getSkillLearningMultiplier(
  skillSlug: string,
  attributes: Record<string, any> | null | undefined,
): { multiplier: number; boostPercent: number; attributeNames: string[] } {
  if (!attributes || !skillSlug)
    return { multiplier: 1.0, boostPercent: 0, attributeNames: [] };
  return calculateWeightedLearningMultiplier(
    skillSlug,
    attributes,
    getLearningAttributeLinks(skillSlug),
  );
}

export function applyLearningMultiplier(
  baseXp: number,
  skillSlug: string,
  attributes: Record<string, any> | null | undefined,
): { xp: number; multiplier: number; boostPercent: number } {
  const { multiplier, boostPercent } = getSkillLearningMultiplier(
    skillSlug,
    attributes,
  );
  return { xp: Math.round(baseXp * multiplier), multiplier, boostPercent };
}
