/**
 * Tour Fatigue System (v1.0.934)
 * Consecutive gigs without rest degrade performance quality and increase injury/drama risk.
 * Rest days reset the fatigue counter.
 */

export interface FatigueState {
  consecutiveGigs: number;
  fatigueLevel: "fresh" | "normal" | "tired" | "exhausted" | "burnout";
  performanceModifier: number;   // 1.05 (fresh) down to 0.6 (burnout)
  injuryRisk: number;            // 0 – 0.20
  moraleHit: number;             // 0 – 15 points per gig
  needsRest: boolean;
  description: string;
}

interface FatigueThreshold {
  maxGigs: number;
  level: FatigueState["fatigueLevel"];
  performanceModifier: number;
  injuryRisk: number;
  moraleHit: number;
  description: string;
}

const THRESHOLDS: FatigueThreshold[] = [
  { maxGigs: 1,  level: "fresh",     performanceModifier: 1.05, injuryRisk: 0,    moraleHit: 0,  description: "Well-rested — performing at peak" },
  { maxGigs: 3,  level: "normal",    performanceModifier: 1.0,  injuryRisk: 0.01, moraleHit: 0,  description: "In the groove — sustainable pace" },
  { maxGigs: 5,  level: "tired",     performanceModifier: 0.90, injuryRisk: 0.05, moraleHit: 3,  description: "Fatigue setting in — quality dipping" },
  { maxGigs: 8,  level: "exhausted", performanceModifier: 0.75, injuryRisk: 0.12, moraleHit: 8,  description: "Exhausted — serious risk of mistakes" },
  { maxGigs: Infinity, level: "burnout", performanceModifier: 0.60, injuryRisk: 0.20, moraleHit: 15, description: "Burnout — the band needs rest NOW" },
];

/**
 * Get fatigue state from consecutive gig count.
 */
export function getFatigueState(consecutiveGigs: number): FatigueState {
  const clamped = Math.max(0, consecutiveGigs);
  const threshold = THRESHOLDS.find(t => clamped <= t.maxGigs) || THRESHOLDS[THRESHOLDS.length - 1];

  return {
    consecutiveGigs: clamped,
    fatigueLevel: threshold.level,
    performanceModifier: threshold.performanceModifier,
    injuryRisk: threshold.injuryRisk,
    moraleHit: threshold.moraleHit,
    needsRest: clamped >= 5,
    description: threshold.description,
  };
}

/**
 * Calculate fatigue from a list of recent gig dates.
 * Counts consecutive gigs with no rest day (gap > 1 day) between them.
 */
export function calculateConsecutiveGigs(gigDates: Date[]): number {
  if (gigDates.length === 0) return 0;

  const sorted = [...gigDates].sort((a, b) => b.getTime() - a.getTime()); // newest first
  let consecutive = 1;

  for (let i = 1; i < sorted.length; i++) {
    const daysBetween = (sorted[i - 1].getTime() - sorted[i].getTime()) / (1000 * 60 * 60 * 24);
    if (daysBetween <= 1.5) {
      consecutive++;
    } else {
      break; // rest day found
    }
  }

  return consecutive;
}

/**
 * How many rest days needed to fully recover.
 */
export function restDaysNeeded(consecutiveGigs: number): number {
  if (consecutiveGigs <= 3) return 1;
  if (consecutiveGigs <= 5) return 2;
  if (consecutiveGigs <= 8) return 3;
  return 4; // burnout needs 4 days
}

/**
 * Apply fatigue modifier to a base performance score.
 */
export function applyFatigue(baseScore: number, consecutiveGigs: number): number {
  const state = getFatigueState(consecutiveGigs);
  return Math.round(baseScore * state.performanceModifier);
}
