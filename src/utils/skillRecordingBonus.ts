/**
 * Calculate player skill bonus for recording quality.
 * Skills in mixing, DAW, production, and relevant instruments boost recording outcomes.
 */

import type { SkillProgressEntry } from "./skillGearPerformance";
import { getTieredBonusScaled } from "./tieredSkillBonus";

/** Skill slugs relevant to recording quality */
const RECORDING_SKILL_SLUGS = {
  mixing: [
    "songwriting_basic_mixing",
    "songwriting_professional_mixing",
    "songwriting_mastery_mixing",
  ],
  daw: [
    "songwriting_basic_daw",
    "songwriting_professional_daw",
    "songwriting_mastery_daw",
  ],
  production: [
    "songwriting_basic_record_production",
    "songwriting_professional_record_production",
    "songwriting_mastery_record_production",
  ],
  vocalProduction: [
    "songwriting_basic_vocal_processing",
    "songwriting_professional_vocal_production",
    "songwriting_mastery_vocal_processing",
  ],
  theory: [
    "theory_basic_harmony",
    "theory_professional_harmony",
    "theory_mastery_harmony",
  ],
} as const;

/** Maximum bonus percentages for each skill category */
const MAX_BONUSES = {
  mixing: 8,       // 0-8% bonus
  daw: 5,          // 0-5% bonus
  production: 7,   // 0-7% bonus
  vocalProduction: 5, // 0-5% bonus
  theory: 5,       // 0-5% bonus
} as const;

function getMaxLevel(progress: SkillProgressEntry[], slugs: readonly string[]): number {
  let max = 0;
  for (const slug of slugs) {
    const entry = progress.find(p => p.skill_slug === slug);
    if (entry?.current_level != null) {
      max = Math.max(max, entry.current_level);
    }
  }
  return max;
}

export interface RecordingSkillBonus {
  /** Total bonus as a multiplier (1.0 = no bonus, 1.30 = 30% bonus) */
  multiplier: number;
  /** Total bonus percentage (0-30) */
  totalBonusPercent: number;
  /** Breakdown of each skill category's contribution */
  breakdown: {
    mixing: number;
    daw: number;
    production: number;
    vocalProduction: number;
    theory: number;
  };
}

/**
 * Calculate the recording quality bonus based on player skill progress.
 * Returns a multiplier (1.0 to ~1.30) and a percentage breakdown.
 */
export function calculateRecordingSkillBonus(
  progress: SkillProgressEntry[] | null
): RecordingSkillBonus {
  const noBonus: RecordingSkillBonus = {
    multiplier: 1.0,
    totalBonusPercent: 0,
    breakdown: { mixing: 0, daw: 0, production: 0, vocalProduction: 0, theory: 0 },
  };

  if (!progress || progress.length === 0) return noBonus;

  const calc = (slugs: readonly string[], maxBonus: number): number => {
    const level = getMaxLevel(progress, slugs);
    // Tiered bonus: higher levels give progressively more, mastery gets flat bonus
    return getTieredBonusScaled(level, maxBonus);
  };

  const mixing = calc(RECORDING_SKILL_SLUGS.mixing, MAX_BONUSES.mixing);
  const daw = calc(RECORDING_SKILL_SLUGS.daw, MAX_BONUSES.daw);
  const production = calc(RECORDING_SKILL_SLUGS.production, MAX_BONUSES.production);
  const vocalProduction = calc(RECORDING_SKILL_SLUGS.vocalProduction, MAX_BONUSES.vocalProduction);
  const theory = calc(RECORDING_SKILL_SLUGS.theory, MAX_BONUSES.theory);

  const totalBonusPercent = mixing + daw + production + vocalProduction + theory;

  return {
    multiplier: 1 + totalBonusPercent / 100,
    totalBonusPercent: Math.round(totalBonusPercent * 10) / 10,
    breakdown: {
      mixing: Math.round(mixing * 10) / 10,
      daw: Math.round(daw * 10) / 10,
      production: Math.round(production * 10) / 10,
      vocalProduction: Math.round(vocalProduction * 10) / 10,
      theory: Math.round(theory * 10) / 10,
    },
  };
}
