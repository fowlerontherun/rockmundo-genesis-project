/**
 * Skill Learning Multiplier System
 * 
 * Higher attribute values in related areas provide a learning speed bonus
 * when gaining skill XP. This creates a logical progression where experienced
 * musicians learn related skills faster.
 * 
 * Multiplier range: 1.0x (no bonus) to 1.5x (max attributes)
 */

import { SKILL_ATTRIBUTE_MAP, type AttributeKey, ATTRIBUTE_MAX_VALUE, FULL_ATTRIBUTE_METADATA, type FullAttributeKey } from './attributeProgression';

/**
 * Map of skill slugs to the full attribute keys that boost learning speed.
 * Skills benefit from multiple related attributes.
 */
const SKILL_LEARNING_ATTRIBUTES: Record<string, FullAttributeKey[]> = {
  // Instrument skills benefit from musicality + musical_ability
  guitar: ['musicality', 'musical_ability'],
  acoustic_guitar: ['musicality', 'musical_ability'],
  electric_guitar: ['musicality', 'musical_ability'],
  classical_guitar: ['musicality', 'musical_ability'],
  bass: ['musicality', 'rhythm_sense'],
  drums: ['rhythm_sense', 'musicality'],
  keyboards: ['musicality', 'musical_ability'],
  piano: ['musicality', 'musical_ability'],
  saxophone: ['musicality', 'musical_ability'],
  violin: ['musicality', 'musical_ability'],
  
  // Vocal skills benefit from vocal talent + musicality
  vocals: ['vocal_talent', 'musicality'],
  singing: ['vocal_talent', 'musicality'],
  rap: ['vocal_talent', 'charisma'],
  
  // Performance skills benefit from stage presence + charisma
  performance: ['stage_presence', 'crowd_engagement'],
  showmanship: ['stage_presence', 'charisma'],
  crowd_interaction: ['crowd_engagement', 'charisma'],
  improvisation: ['creative_insight', 'musicality'],
  
  // Creative skills benefit from creative insight + mental focus
  songwriting: ['creative_insight', 'mental_focus'],
  composition: ['creative_insight', 'musicality'],
  creativity: ['creative_insight', 'mental_focus'],
  lyrics: ['creative_insight', 'mental_focus'],
  
  // Technical skills benefit from technical mastery + mental focus
  technical: ['technical_mastery', 'mental_focus'],
  mixing: ['technical_mastery', 'mental_focus'],
  mastering: ['technical_mastery', 'mental_focus'],
  production: ['technical_mastery', 'creative_insight'],
  sound_engineering: ['technical_mastery', 'mental_focus'],
  
  // Business/social skills benefit from charisma + social reach
  marketing: ['social_reach', 'charisma'],
  networking: ['charisma', 'social_reach'],
  negotiation: ['charisma', 'mental_focus'],
  management: ['mental_focus', 'charisma'],
  teaching: ['mental_focus', 'charisma'],
  
  // Physical skills benefit from endurance
  touring: ['physical_endurance', 'mental_focus'],
  fitness: ['physical_endurance', 'mental_focus'],
};

/**
 * Calculate the skill learning multiplier based on attribute values.
 * 
 * @param skillSlug - The skill being trained
 * @param attributes - The player's attribute snapshot (or null)
 * @returns multiplier between 1.0 and 1.5
 */
export function getSkillLearningMultiplier(
  skillSlug: string,
  attributes: Record<string, any> | null | undefined,
): { multiplier: number; boostPercent: number; attributeNames: string[] } {
  if (!attributes || !skillSlug) {
    return { multiplier: 1.0, boostPercent: 0, attributeNames: [] };
  }

  // Find the relevant attributes for this skill
  const relevantAttrs = SKILL_LEARNING_ATTRIBUTES[skillSlug];
  
  if (!relevantAttrs || relevantAttrs.length === 0) {
    // Fallback: check the basic SKILL_ATTRIBUTE_MAP
    const basicAttr = SKILL_ATTRIBUTE_MAP[skillSlug];
    if (!basicAttr) {
      return { multiplier: 1.0, boostPercent: 0, attributeNames: [] };
    }
    
    const value = Math.max(0, Math.min(ATTRIBUTE_MAX_VALUE, Number(attributes[basicAttr]) || 0));
    // Scale: 0-1000 attribute → 1.0x to 1.5x multiplier
    const bonus = (value / ATTRIBUTE_MAX_VALUE) * 0.5;
    return {
      multiplier: 1 + bonus,
      boostPercent: Math.round(bonus * 100),
      attributeNames: [basicAttr],
    };
  }

  // Average the relevant attribute values
  let totalValue = 0;
  const attrNames: string[] = [];
  
  for (const attrKey of relevantAttrs) {
    const value = Math.max(0, Math.min(ATTRIBUTE_MAX_VALUE, Number(attributes[attrKey]) || 0));
    totalValue += value;
    attrNames.push(attrKey);
  }
  
  const avgValue = totalValue / relevantAttrs.length;
  
  // Scale: 0-1000 average → 1.0x to 1.5x multiplier
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
