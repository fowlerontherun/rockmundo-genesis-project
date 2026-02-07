/**
 * Calculate skill-based rehearsal efficiency multiplier.
 * Higher instrument skill and music theory = faster familiarity gains.
 */

import type { SkillProgressEntry } from "./skillGearPerformance";
import { ROLE_SKILL_MAP } from "./skillGearPerformance";

const THEORY_SLUGS = [
  "theory_basic_harmony",
  "theory_professional_harmony",
  "theory_mastery_harmony",
  "theory_basic_ear_training",
  "theory_professional_ear_training",
  "theory_mastery_ear_training",
  "theory_basic_sight_reading",
  "theory_professional_sight_reading",
  "theory_mastery_sight_reading",
] as const;

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

export interface RehearsalEfficiency {
  /** Total efficiency multiplier (1.0 = baseline, up to ~1.6) */
  multiplier: number;
  /** Instrument skill contribution */
  instrumentBonus: number;
  /** Theory contribution */
  theoryBonus: number;
}

/**
 * Calculate how much faster a band rehearses based on member skills.
 * - Instrument skill: up to 1.5x efficiency (skillLevel / 200 bonus)
 * - Theory: up to 0.1x efficiency (10% bonus at max theory)
 * - Total max: ~1.6x (a skilled band reaches Perfected in ~3.75 hours vs 6)
 * 
 * @param progress - All band members' skill progress entries
 * @param roles - Band member roles (for relevant instrument skill lookup)
 */
export function calculateRehearsalEfficiency(
  progress: SkillProgressEntry[] | null,
  roles?: string[]
): RehearsalEfficiency {
  const noBonus: RehearsalEfficiency = { multiplier: 1.0, instrumentBonus: 0, theoryBonus: 0 };

  if (!progress || progress.length === 0) return noBonus;

  // Get average instrument skill across all roles
  let totalInstrumentLevel = 0;
  let roleCount = 0;

  const effectiveRoles = roles && roles.length > 0 ? roles : ["Vocals"];

  for (const role of effectiveRoles) {
    const skillSlugs = ROLE_SKILL_MAP[role] || [];
    if (skillSlugs.length > 0) {
      const level = getMaxLevel(progress, skillSlugs);
      totalInstrumentLevel += level;
      roleCount++;
    }
  }

  const avgInstrumentLevel = roleCount > 0 ? totalInstrumentLevel / roleCount : 0;
  // Skill level 0-20 maps to 0-0.5 bonus (1.0x to 1.5x)
  const instrumentBonus = Math.min(0.5, avgInstrumentLevel / 40);

  // Theory bonus: max level across theory skills, up to 0.1 bonus
  const theoryLevel = getMaxLevel(progress, THEORY_SLUGS);
  const theoryBonus = Math.min(0.1, (theoryLevel / 20) * 0.1);

  return {
    multiplier: 1.0 + instrumentBonus + theoryBonus,
    instrumentBonus: Math.round(instrumentBonus * 1000) / 1000,
    theoryBonus: Math.round(theoryBonus * 1000) / 1000,
  };
}
