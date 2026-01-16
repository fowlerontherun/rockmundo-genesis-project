/**
 * Learning Speed Utility
 * Calculates attribute-based learning speed multipliers for skill progression
 */

export interface PlayerAttributes {
  musical_ability?: number;
  vocal_talent?: number;
  rhythm_sense?: number;
  creative_insight?: number;
  technical_mastery?: number;
  stage_presence?: number;
}

// Maximum bonus multiplier (50% extra XP at max attribute)
const MAX_ATTRIBUTE_VALUE = 1000;
const MAX_BONUS_MULTIPLIER = 0.5;

/**
 * Calculate learning speed multiplier based on skill category and player attributes
 * Returns a multiplier between 1.0 and 1.5 (up to 50% bonus XP)
 */
export function calculateLearningMultiplier(
  skillSlug: string,
  attributes: PlayerAttributes | null
): number {
  if (!attributes) return 1.0;

  const baseMultiplier = 1.0;
  let relevantAttribute = 0;

  // Determine which attribute affects this skill category
  if (
    skillSlug.includes('instruments_') ||
    skillSlug.includes('keyboard') ||
    skillSlug.includes('guitar') ||
    skillSlug.includes('bass') ||
    skillSlug.includes('strings')
  ) {
    relevantAttribute = attributes.musical_ability ?? 0;
  } else if (
    skillSlug.includes('singing') ||
    skillSlug.includes('vocal') ||
    skillSlug.includes('rapping')
  ) {
    relevantAttribute = attributes.vocal_talent ?? 0;
  } else if (
    skillSlug.includes('drums') ||
    skillSlug.includes('percussion') ||
    skillSlug.includes('beatmaking') ||
    skillSlug.includes('rhythm')
  ) {
    relevantAttribute = attributes.rhythm_sense ?? 0;
  } else if (
    skillSlug.includes('songwriting_') ||
    skillSlug.includes('lyrics') ||
    skillSlug.includes('composing')
  ) {
    relevantAttribute = attributes.creative_insight ?? 0;
  } else if (
    skillSlug.includes('production') ||
    skillSlug.includes('mixing') ||
    skillSlug.includes('daw') ||
    skillSlug.includes('sound_design')
  ) {
    relevantAttribute = attributes.technical_mastery ?? 0;
  } else if (
    skillSlug.includes('stage_') ||
    skillSlug.includes('showmanship') ||
    skillSlug.includes('crowd')
  ) {
    relevantAttribute = attributes.stage_presence ?? 0;
  } else if (skillSlug.includes('genres_')) {
    // Genre skills benefit from a mix of attributes - use the highest
    relevantAttribute = Math.max(
      attributes.musical_ability ?? 0,
      attributes.creative_insight ?? 0
    );
  }

  // Calculate bonus: (attribute / max) * max_bonus
  const bonus = (Math.min(relevantAttribute, MAX_ATTRIBUTE_VALUE) / MAX_ATTRIBUTE_VALUE) * MAX_BONUS_MULTIPLIER;

  return baseMultiplier + bonus;
}

/**
 * Apply learning multiplier to XP amount
 */
export function applyLearningMultiplier(
  baseXp: number,
  skillSlug: string,
  attributes: PlayerAttributes | null
): number {
  const multiplier = calculateLearningMultiplier(skillSlug, attributes);
  return Math.floor(baseXp * multiplier);
}

/**
 * Get the attribute name that affects a skill
 */
export function getRelevantAttribute(skillSlug: string): keyof PlayerAttributes | null {
  if (skillSlug.includes('instruments_') || skillSlug.includes('guitar') || skillSlug.includes('bass')) {
    return 'musical_ability';
  }
  if (skillSlug.includes('singing') || skillSlug.includes('vocal') || skillSlug.includes('rapping')) {
    return 'vocal_talent';
  }
  if (skillSlug.includes('drums') || skillSlug.includes('percussion') || skillSlug.includes('beatmaking')) {
    return 'rhythm_sense';
  }
  if (skillSlug.includes('songwriting_') || skillSlug.includes('lyrics') || skillSlug.includes('composing')) {
    return 'creative_insight';
  }
  if (skillSlug.includes('production') || skillSlug.includes('mixing') || skillSlug.includes('daw')) {
    return 'technical_mastery';
  }
  if (skillSlug.includes('stage_') || skillSlug.includes('showmanship') || skillSlug.includes('crowd')) {
    return 'stage_presence';
  }
  return null;
}
