import { describe, expect, it } from 'vitest';
import {
  applyClothingPerformanceBonusToGigRating,
  calculateBandClothingPerformanceBonus,
} from './clothingPerformanceBonus';

describe('clothing performance bonus', () => {
  it('averages active member bonuses instead of summing them', () => {
    const result = calculateBandClothingPerformanceBonus({
      memberPerformancePercents: [20, 10, 0, 0],
    });

    expect(result.performancePct).toBe(7.5);
    expect(result.multiplier).toBe(1.075);
    expect(result.activeMembers).toBe(4);
    expect(result.membersWithBonus).toBe(2);
  });

  it('caps each member and the resulting band modifier at 20 percent', () => {
    const result = calculateBandClothingPerformanceBonus({
      memberPerformancePercents: [50, 50],
    });

    expect(result.performancePct).toBe(20);
    expect(result.multiplier).toBe(1.2);
  });

  it('does not increase the 25 point gig ceiling', () => {
    expect(applyClothingPerformanceBonusToGigRating(24, 20)).toBe(25);
    expect(applyClothingPerformanceBonusToGigRating(20, 10)).toBeCloseTo(22);
  });

  it('returns a neutral modifier for an empty lineup', () => {
    expect(calculateBandClothingPerformanceBonus({ memberPerformancePercents: [] })).toEqual({
      performancePct: 0,
      multiplier: 1,
      activeMembers: 0,
      membersWithBonus: 0,
    });
  });
});
