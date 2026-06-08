/**
 * Skill Learning Multiplier System
 *
 * Higher attribute values in related areas provide a learning speed bonus
 * when gaining skill XP. Multiplier range: 1.0x → 1.5x.
 *
 * Slugs follow `<prefix>_<tier>_<topic>` (e.g. `instruments_basic_electric_guitar`).
 * We match by topic keywords (regex) so every real slug gets a bonus when the
 * relevant attribute is high.
 */

import { SKILL_ATTRIBUTE_MAP, ATTRIBUTE_MAX_VALUE, type FullAttributeKey } from './attributeProgression';

interface MultiplierRule {
  pattern: RegExp;
  attributes: FullAttributeKey[];
}

const RULES: MultiplierRule[] = [
  // Vocals / rap
  { pattern: /(?:^|_)(vocal|singing|rapping|ad_libs)(?:$|_)/, attributes: ['vocal_talent', 'musicality'] },
  // Drums & percussion-style instruments
  { pattern: /(?:_drums|_percussion|tabla|djembe|bongos|cajon|taiko|snare|timpani|beatmaking)(?:$|_)/, attributes: ['rhythm_sense', 'musicality'] },
  // Stage skills
  { pattern: /^stage_/, attributes: ['stage_presence', 'crowd_engagement'] },
  // Audience psychology
  { pattern: /^audience_/, attributes: ['crowd_engagement', 'charisma'] },
  // Business
  { pattern: /^business_/, attributes: ['social_reach', 'charisma'] },
  // Health
  { pattern: /^health_/, attributes: ['physical_endurance', 'mental_focus'] },
  // Songwriting subtopics
  { pattern: /songwriting_.*_(?:composing|lyrics|record_production|sampling|sound_design|ai_music)/, attributes: ['creative_insight', 'musicality'] },
  { pattern: /songwriting_.*_(?:mixing|daw|vocal_processing|beatmaking)/, attributes: ['technical_mastery', 'creative_insight'] },
  // Theory
  { pattern: /^theory_/, attributes: ['musicality', 'mental_focus'] },
  // Improvisation
  { pattern: /^improv_/, attributes: ['creative_insight', 'musicality'] },
  // DJ
  { pattern: /^dj_/, attributes: ['rhythm_sense', 'crowd_engagement'] },
  // Teaching
  { pattern: /^teaching_/, attributes: ['mental_focus', 'charisma'] },
  // Genres
  { pattern: /^genres_/, attributes: ['musical_ability', 'creative_insight'] },
  // Luthiery
  { pattern: /^luthiery_/, attributes: ['technical_mastery', 'mental_focus'] },
  // Modeling / fashion / clothing
  { pattern: /^modeling_/, attributes: ['charisma', 'stage_presence'] },
  { pattern: /^fashion_/, attributes: ['creative_insight', 'charisma'] },
  { pattern: /^clothing_/, attributes: ['creative_insight', 'technical_mastery'] },
  // Default instruments bucket (must come last among instrument-related)
  { pattern: /^instruments_/, attributes: ['musical_ability', 'musicality'] },
];

function pickAttributes(skillSlug: string): FullAttributeKey[] {
  for (const rule of RULES) {
    if (rule.pattern.test(skillSlug)) return rule.attributes;
  }
  return [];
}

/**
 * Calculate the skill learning multiplier based on attribute values.
 */
export function getSkillLearningMultiplier(
  skillSlug: string,
  attributes: Record<string, any> | null | undefined,
): { multiplier: number; boostPercent: number; attributeNames: string[] } {
  if (!attributes || !skillSlug) {
    return { multiplier: 1.0, boostPercent: 0, attributeNames: [] };
  }

  const relevantAttrs = pickAttributes(skillSlug);

  if (relevantAttrs.length === 0) {
    const basicAttr = SKILL_ATTRIBUTE_MAP[skillSlug];
    if (!basicAttr) {
      return { multiplier: 1.0, boostPercent: 0, attributeNames: [] };
    }
    const value = Math.max(0, Math.min(ATTRIBUTE_MAX_VALUE, Number(attributes[basicAttr]) || 0));
    const bonus = (value / ATTRIBUTE_MAX_VALUE) * 0.5;
    return {
      multiplier: 1 + bonus,
      boostPercent: Math.round(bonus * 100),
      attributeNames: [basicAttr],
    };
  }

  let totalValue = 0;
  const attrNames: string[] = [];
  for (const attrKey of relevantAttrs) {
    const value = Math.max(0, Math.min(ATTRIBUTE_MAX_VALUE, Number(attributes[attrKey]) || 0));
    totalValue += value;
    attrNames.push(attrKey);
  }
  const avgValue = totalValue / relevantAttrs.length;
  const bonus = (avgValue / ATTRIBUTE_MAX_VALUE) * 0.5;

  return {
    multiplier: parseFloat((1 + bonus).toFixed(3)),
    boostPercent: Math.round(bonus * 100),
    attributeNames: attrNames,
  };
}

/**
 * Apply the learning multiplier to an XP amount.
 */
export function applyLearningMultiplier(
  baseXp: number,
  skillSlug: string,
  attributes: Record<string, any> | null | undefined,
): { xp: number; multiplier: number; boostPercent: number } {
  const { multiplier, boostPercent } = getSkillLearningMultiplier(skillSlug, attributes);
  return {
    xp: Math.round(baseXp * multiplier),
    multiplier,
    boostPercent,
  };
}
