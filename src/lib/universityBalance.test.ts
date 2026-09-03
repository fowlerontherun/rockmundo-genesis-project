import { describe, expect, it } from "vitest";

import {
  calculateUniversityCourseDuration,
  calculateUniversityCoursePrice,
  calculateUniversityCourseXpRange,
  getUniversityPrestigeBand,
  getUniversityQualityBand,
  normalizeUniversityRating,
} from "./universityBalance";

describe("university balance helpers", () => {
  it("normalizes university ratings to the public 0-100 scale", () => {
    expect(normalizeUniversityRating(-10)).toBe(0);
    expect(normalizeUniversityRating(84.6)).toBe(85);
    expect(normalizeUniversityRating(120)).toBe(100);
    expect(normalizeUniversityRating(null)).toBe(50);
  });

  it("maps numeric ratings to clear player-facing bands", () => {
    expect(getUniversityPrestigeBand(100).label).toBe("Iconic");
    expect(getUniversityPrestigeBand(85).label).toBe("World-class");
    expect(getUniversityPrestigeBand(59).label).toBe("Regional");
    expect(getUniversityQualityBand(95).label).toBe("Exceptional");
    expect(getUniversityQualityBand(75).label).toBe("Advanced");
    expect(getUniversityQualityBand(50).label).toBe("Developing");
  });

  it("uses the university modifier for the price actually charged", () => {
    expect(calculateUniversityCoursePrice(1_250, 1.4)).toBe(1_750);
    expect(calculateUniversityCoursePrice(999, 1.15)).toBe(1_148);
    expect(calculateUniversityCoursePrice(undefined, undefined)).toBe(0);
  });

  it("shortens the same base course at higher-quality universities", () => {
    expect(calculateUniversityCourseDuration(10, 100)).toBe(10);
    expect(calculateUniversityCourseDuration(10, 80)).toBe(12);
    expect(calculateUniversityCourseDuration(10, 50)).toBe(15);
  });

  it("calculates the full expected XP range from the effective duration", () => {
    expect(calculateUniversityCourseXpRange(20, 32, 8)).toEqual({
      minimum: 160,
      maximum: 256,
    });
  });
});
