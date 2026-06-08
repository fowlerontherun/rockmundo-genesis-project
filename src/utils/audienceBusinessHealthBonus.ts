/**
 * Aggregated bonuses for previously-dead skill families.
 * Each family follows the same tiered scaler so effects are predictable.
 */
import type { SkillProgressEntry } from "./skillGearPerformance";
import { getTieredBonusScaled } from "./tieredSkillBonus";

type Progress = ReadonlyArray<SkillProgressEntry> | null | undefined;

const tiers = (prefix: string, topic: string) => [
  `${prefix}_basic_${topic}`,
  `${prefix}_professional_${topic}`,
  `${prefix}_mastery_${topic}`,
];

function maxLevel(progress: Progress, slugs: readonly string[]): number {
  if (!progress?.length) return 0;
  let max = 0;
  for (const slug of slugs) {
    const e = progress.find((p) => p.skill_slug === slug);
    if (e?.current_level != null && e.current_level > max) max = e.current_level;
  }
  return max;
}

// =========================== Audience ============================
export interface AudienceBonus {
  /** Multiplier on merch + tip revenue at gigs */
  merchMultiplier: number;
  /** Multiplier on first-week streaming on releases */
  releaseLaunchMultiplier: number;
}
export function calculateAudienceBonus(progress: Progress): AudienceBonus {
  const engagement = getTieredBonusScaled(maxLevel(progress, tiers("audience", "engagement")), 10);
  const trends = getTieredBonusScaled(maxLevel(progress, tiers("audience", "trends")), 10);
  return {
    merchMultiplier: 1 + engagement / 100,
    releaseLaunchMultiplier: 1 + trends / 100,
  };
}

// =========================== Business ============================
export interface BusinessBonus {
  /** Multiplier on negotiated contract value (sponsorship / label) */
  contractMultiplier: number;
  /** Multiplier on auto-hype gain from promo activities */
  marketingMultiplier: number;
  /** Multiplier on venue offers / fees */
  bookingMultiplier: number;
}
export function calculateBusinessBonus(progress: Progress): BusinessBonus {
  const contracts = getTieredBonusScaled(maxLevel(progress, tiers("business", "contracts")), 10);
  const marketing = getTieredBonusScaled(maxLevel(progress, tiers("business", "marketing")), 10);
  const booking = getTieredBonusScaled(maxLevel(progress, tiers("business", "booking")), 10);
  return {
    contractMultiplier: 1 + contracts / 100,
    marketingMultiplier: 1 + marketing / 100,
    bookingMultiplier: 1 + booking / 100,
  };
}

// =========================== Health ==============================
export interface HealthSkillBonus {
  /** Multiplier on stamina loss while touring (lower is better) */
  tourFatigueReducer: number;
  /** Multiplier on vocal-strain ailment probability (lower is better) */
  vocalStrainReducer: number;
  /** Multiplier on stress accumulation (lower is better) */
  stressReducer: number;
}
export function calculateHealthSkillBonus(progress: Progress): HealthSkillBonus {
  const conditioning = getTieredBonusScaled(maxLevel(progress, tiers("health", "conditioning")), 25);
  const vocal = getTieredBonusScaled(maxLevel(progress, tiers("health", "vocal")), 30);
  const mental = getTieredBonusScaled(maxLevel(progress, tiers("health", "mental")), 25);
  return {
    tourFatigueReducer: Math.max(0.5, 1 - conditioning / 100),
    vocalStrainReducer: Math.max(0.4, 1 - vocal / 100),
    stressReducer: Math.max(0.5, 1 - mental / 100),
  };
}

// =========================== Improv ==============================
export interface ImprovBonus {
  /** Multiplier on random gig-disaster severity (lower is better) */
  disasterSeverityReducer: number;
  /** Multiplier on 'song ruined' probability during a gig (lower is better) */
  ruinChanceReducer: number;
}
export function calculateImprovBonus(progress: Progress): ImprovBonus {
  const musical = getTieredBonusScaled(maxLevel(progress, tiers("improv", "musical")), 30);
  const recovery = getTieredBonusScaled(maxLevel(progress, tiers("improv", "recovery")), 35);
  return {
    disasterSeverityReducer: Math.max(0.4, 1 - musical / 100),
    ruinChanceReducer: Math.max(0.3, 1 - recovery / 100),
  };
}

// =========================== Theory (extra) ======================
/** Extra theory bonuses beyond what skillRecordingBonus already grants for harmony. */
export interface TheoryExtraBonus {
  /** Adds to recording quality bonus percent */
  earTrainingRecordingPercent: number;
  sightReadingRecordingPercent: number;
  /** Adds to melody strength in songQuality calculation */
  harmonyMelodyBonus: number;
}
export function calculateTheoryExtraBonus(progress: Progress): TheoryExtraBonus {
  const ear = getTieredBonusScaled(maxLevel(progress, tiers("theory", "ear_training")), 3);
  const sight = getTieredBonusScaled(maxLevel(progress, tiers("theory", "sight_reading")), 3);
  const harmony = getTieredBonusScaled(maxLevel(progress, tiers("theory", "harmony")), 25);
  return {
    earTrainingRecordingPercent: ear,
    sightReadingRecordingPercent: sight,
    harmonyMelodyBonus: harmony,
  };
}
