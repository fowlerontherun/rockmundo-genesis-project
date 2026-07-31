/** Pure, versioned live-performance rules shared by gigs and festivals.
 * Random variance is an input: callers must freeze it in the performance outcome.
 */
export const LIVE_PERFORMANCE_RULES_VERSION = "live-performance-v1";

export type FanTiers = { casual: number; dedicated: number; superfans: number; total: number };

export function allocateFanTiers(total: number, rating: number): FanTiers {
  const safeTotal = Math.max(0, Math.min(1_000_000, Math.floor(total)));
  const superRate = rating >= 22 ? .15 : rating >= 16 ? .05 : .02;
  const dedicatedRate = rating >= 22 ? .35 : rating >= 16 ? .25 : .10;
  const superfans = Math.floor(safeTotal * superRate);
  const dedicated = Math.floor(safeTotal * dedicatedRate);
  return { casual: safeTotal - dedicated - superfans, dedicated, superfans, total: safeTotal };
}

export function calculateFestivalFans(audience: number, score: number, existingFame: number, frozenVariance = 1): FanTiers {
  const rating = Math.max(0, Math.min(25, score / 4));
  const famePenalty = Math.max(.3, 1 - Math.max(0, existingFame) / 10_000);
  const total = Math.floor(Math.max(0, audience) * .02 * (1 + rating / 25) * famePenalty * Math.max(.8, Math.min(1.2, frozenVariance)));
  return allocateFanTiers(total, rating);
}

export const calculateFame = (score: number, audience: number) =>
  Math.max(-10, Math.min(20, Math.round((score - 55) / 10) + (audience >= 5000 ? 2 : audience >= 1000 ? 1 : 0)));
export const calculateMemberXp = (score: number, attendance: string) =>
  attendance === "present" || attendance === "late" ? Math.max(1, Math.min(100, Math.round(score / 5))) : 0;
export const calculateChemistryContribution = (score: number) => score >= 75 ? 1 : score < 40 ? -1 : 0;
export const isCompletedSong = (songIds: readonly string[], songId: string) => songIds.includes(songId);
export const stableReference = (sourceType: "ordinary_gig" | "festival_performance", sourceId: string, effect: string, subjectId: string) =>
  `${sourceType === "festival_performance" ? "festival-performance" : "ordinary-gig"}:${sourceId}:${effect}:${subjectId}`;
