/**
 * Bonuses from Stage & Showmanship skills, applied to live performance scores.
 * Uses the shared tiered bonus scaler for consistency with other skill utilities.
 */
import type { SkillProgressEntry } from "./skillGearPerformance";
import { getTieredBonusScaled } from "./tieredSkillBonus";

const STAGE_GROUPS = {
  /** Engagement: showmanship + crowd reading */
  engagement: [
    "stage_basic_showmanship", "stage_professional_showmanship", "stage_mastery_showmanship",
    "stage_basic_crowd", "stage_professional_crowd", "stage_mastery_crowd",
  ],
  /** Technical execution: tech + visuals */
  execution: [
    "stage_basic_tech", "stage_professional_tech", "stage_mastery_tech",
    "stage_basic_visuals", "stage_professional_visuals", "stage_mastery_visuals",
  ],
  /** Fan conversion: social + streaming presence */
  conversion: [
    "stage_basic_social", "stage_professional_social", "stage_mastery_social",
    "stage_basic_streaming", "stage_professional_streaming", "stage_mastery_streaming",
  ],
} as const;

const MAX_BONUSES = {
  engagement: 6,   // up to +6% audience score
  execution: 4,    // up to +4% to technical execution
  conversion: 4,   // up to +4% fan conversion / post-show streams
} as const;

function maxLevel(progress: ReadonlyArray<SkillProgressEntry>, slugs: readonly string[]): number {
  let max = 0;
  for (const slug of slugs) {
    const e = progress.find((p) => p.skill_slug === slug);
    if (e?.current_level != null && e.current_level > max) max = e.current_level;
  }
  return max;
}

export interface StageSkillBonus {
  /** Total bonus as a multiplier (1.0 - 1.14) */
  multiplier: number;
  totalBonusPercent: number;
  breakdown: { engagement: number; execution: number; conversion: number };
}

export function calculateStageSkillBonus(
  progress: ReadonlyArray<SkillProgressEntry> | null | undefined,
): StageSkillBonus {
  const empty: StageSkillBonus = {
    multiplier: 1, totalBonusPercent: 0,
    breakdown: { engagement: 0, execution: 0, conversion: 0 },
  };
  if (!progress?.length) return empty;

  const engagement = getTieredBonusScaled(maxLevel(progress, STAGE_GROUPS.engagement), MAX_BONUSES.engagement);
  const execution = getTieredBonusScaled(maxLevel(progress, STAGE_GROUPS.execution), MAX_BONUSES.execution);
  const conversion = getTieredBonusScaled(maxLevel(progress, STAGE_GROUPS.conversion), MAX_BONUSES.conversion);

  const total = engagement + execution + conversion;
  return {
    multiplier: 1 + total / 100,
    totalBonusPercent: Math.round(total * 10) / 10,
    breakdown: {
      engagement: Math.round(engagement * 10) / 10,
      execution: Math.round(execution * 10) / 10,
      conversion: Math.round(conversion * 10) / 10,
    },
  };
}
