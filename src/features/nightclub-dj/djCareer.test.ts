import { describe, expect, it } from "vitest";
import { summarizeDjCareer, type DjCareerPerformance } from "./djCareer";

const row = (patch: Partial<DjCareerPerformance> = {}): DjCareerPerformance => ({
  id: "performance",
  booking_id: "booked-set",
  performance_score: 80,
  cash_earned: 150,
  fame_gained: 12,
  xp_gained: 30,
  ...patch,
});

describe("server-verified DJ career projection", () => {
  it("excludes old instant-play records from verified booked set totals", () => {
    const summary = summarizeDjCareer([
      row(),
      row({ id: "legacy", booking_id: null, cash_earned: 99999, fame_gained: 9000, xp_gained: 999, performance_score: 100 }),
      row({ id: "second", cash_earned: 50, fame_gained: 8, xp_gained: 20, performance_score: 60 }),
    ], 2);
    expect(summary).toEqual({
      verifiedTotal: 2, sampled: 2, recentCash: 200, recentFame: 20,
      recentXp: 50, averageScore: 70, isPartial: false,
    });
  });

  it("labels capped history as recent rather than pretending to show lifetime earnings", () => {
    const summary = summarizeDjCareer([row()], 140);
    expect(summary.verifiedTotal).toBe(140);
    expect(summary.sampled).toBe(1);
    expect(summary.recentCash).toBe(150);
    expect(summary.isPartial).toBe(true);
  });

  it("ignores non-finite values and preserves a valid zero score", () => {
    const summary = summarizeDjCareer([
      row({ cash_earned: Number.NaN, fame_gained: Infinity, xp_gained: null, performance_score: 0 }),
      row({ id: "other", performance_score: null }),
    ], null);
    expect(summary.averageScore).toBe(0);
    expect(summary.recentCash).toBe(150);
    expect(summary.recentFame).toBe(12);
    expect(summary.recentXp).toBe(30);
    expect(summary.verifiedTotal).toBe(2);
  });

  it("shows an empty career with no invented scores, earnings or reputation", () => {
    expect(summarizeDjCareer([], 0)).toEqual({
      verifiedTotal: 0, sampled: 0, recentCash: 0, recentFame: 0,
      recentXp: 0, averageScore: null, isPartial: false,
    });
  });
});
