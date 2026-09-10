export interface BandClothingPerformanceBonusInput {
  memberPerformancePercents: number[];
  maxOutfitPercent?: number;
}

export interface BandClothingPerformanceBonusResult {
  performancePct: number;
  multiplier: number;
  activeMembers: number;
  membersWithBonus: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));

/**
 * Mirrors the database contract used by get_band_equipped_clothing_performance_bonus.
 * The band's modifier is the average active-member clothing bonus, not the sum.
 */
export function calculateBandClothingPerformanceBonus({
  memberPerformancePercents,
  maxOutfitPercent = 20,
}: BandClothingPerformanceBonusInput): BandClothingPerformanceBonusResult {
  if (memberPerformancePercents.length === 0) {
    return { performancePct: 0, multiplier: 1, activeMembers: 0, membersWithBonus: 0 };
  }

  const values = memberPerformancePercents.map((value) => clamp(value, 0, maxOutfitPercent));
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const performancePct = clamp(average, 0, maxOutfitPercent);

  return {
    performancePct,
    multiplier: 1 + performancePct / 100,
    activeMembers: values.length,
    membersWithBonus: values.filter((value) => value > 0).length,
  };
}

export function applyClothingPerformanceBonusToGigRating(
  rating: number,
  performancePct: number,
  ceiling = 25,
): number {
  const safeRating = clamp(rating, 0, ceiling);
  const safePct = clamp(performancePct, 0, 20);
  return clamp(safeRating * (1 + safePct / 100), 0, ceiling);
}
