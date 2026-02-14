/**
 * Tiered skill bonus calculation.
 * Skill levels 0-20 grant increasing returns at higher tiers,
 * with a mastery bonus at level 20.
 *
 * Tier breakdown (per level):
 *   Levels 1-5   (Beginner):      0.5% each  →  2.5% cumulative
 *   Levels 6-10  (Intermediate):  1.0% each  →  7.5% cumulative
 *   Levels 11-15 (Advanced):      1.5% each  → 15.0% cumulative
 *   Levels 16-19 (Expert):        2.0% each  → 23.0% cumulative
 *   Level 20     (Mastered):      +5% flat   → 28.0% total
 *
 * The result can be scaled by a `maxBonusPercent` to fit different systems.
 */

/** Raw tiered bonus percentage for a skill level 0-20 (max ~28%) */
export function getTieredBonusPercent(level: number): number {
  const lvl = Math.max(0, Math.min(20, Math.round(level)));
  if (lvl === 0) return 0;

  let bonus = 0;

  // Beginner: levels 1-5 → 0.5% each
  const beginner = Math.min(lvl, 5);
  bonus += beginner * 0.5;

  // Intermediate: levels 6-10 → 1.0% each
  if (lvl > 5) {
    const intermediate = Math.min(lvl, 10) - 5;
    bonus += intermediate * 1.0;
  }

  // Advanced: levels 11-15 → 1.5% each
  if (lvl > 10) {
    const advanced = Math.min(lvl, 15) - 10;
    bonus += advanced * 1.5;
  }

  // Expert: levels 16-19 → 2.0% each
  if (lvl > 15) {
    const expert = Math.min(lvl, 19) - 15;
    bonus += expert * 2.0;
  }

  // Mastery: level 20 → flat +5%
  if (lvl >= 20) {
    bonus += 5;
  }

  return bonus;
}

/** Maximum raw tiered bonus (at level 20) */
export const MAX_TIERED_BONUS = getTieredBonusPercent(20); // 28

/**
 * Scaled tiered bonus: maps the raw 0-28% curve onto a custom max.
 * Example: getTieredBonusScaled(level, 20) → 0 to 20% with tiered curve.
 */
export function getTieredBonusScaled(level: number, maxBonusPercent: number): number {
  const raw = getTieredBonusPercent(level);
  return (raw / MAX_TIERED_BONUS) * maxBonusPercent;
}

/**
 * Returns a multiplier (e.g. 1.0 to 1.28) from the tiered curve.
 */
export function getTieredMultiplier(level: number): number {
  return 1 + getTieredBonusPercent(level) / 100;
}

/**
 * Returns a scaled multiplier (e.g. 1.0 to 1 + maxBonusPercent/100).
 */
export function getTieredMultiplierScaled(level: number, maxBonusPercent: number): number {
  return 1 + getTieredBonusScaled(level, maxBonusPercent) / 100;
}
