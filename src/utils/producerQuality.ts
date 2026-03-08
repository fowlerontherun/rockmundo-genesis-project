/**
 * Calculate player producer quality stats from skill levels.
 * Skills: record_production (basic/pro/mastery), mixing, daw, composing, music_theory
 */

export interface ProducerSkillLevels {
  basicProduction: number;
  proProduction: number;
  masteryProduction: number;
  mixingLevel: number;
  dawLevel: number;
  composingLevel: number;
  musicTheoryLevel: number;
}

export interface ProducerQualityStats {
  qualityBonus: number;     // 0-25
  mixingSkill: number;      // 0-100
  arrangementSkill: number; // 0-100
}

export function calculateProducerQualityStats(skills: ProducerSkillLevels): ProducerQualityStats {
  // quality_bonus = floor(basic/20) + floor(pro/10) + floor(mastery/5), cap 25
  const qualityBonus = Math.min(25,
    Math.floor(skills.basicProduction / 20) +
    Math.floor(skills.proProduction / 10) +
    Math.floor(skills.masteryProduction / 5)
  );

  // mixing = floor(mixing_level * 0.8) + floor(daw_level * 0.2), cap 100
  const mixingSkill = Math.min(100,
    Math.floor(skills.mixingLevel * 0.8) + Math.floor(skills.dawLevel * 0.2)
  );

  // arrangement = floor(composing * 0.6) + floor(theory * 0.4), cap 100
  const arrangementSkill = Math.min(100,
    Math.floor(skills.composingLevel * 0.6) + Math.floor(skills.musicTheoryLevel * 0.4)
  );

  return { qualityBonus, mixingSkill, arrangementSkill };
}

/**
 * Calculate XP reward for producing a session
 */
export function calculateProducingXP(
  durationHours: number,
  finalQuality: number,
  genreMatches: boolean
): number {
  let xp = durationHours * 50;

  if (finalQuality > 900) xp += 100;
  else if (finalQuality > 700) xp += 50;
  else if (finalQuality > 500) xp += 25;

  if (genreMatches) xp = Math.floor(xp * 1.2);

  return Math.round(xp);
}

/** Minimum skill level required to register as a producer */
export const MIN_PRODUCTION_SKILL = 100;
