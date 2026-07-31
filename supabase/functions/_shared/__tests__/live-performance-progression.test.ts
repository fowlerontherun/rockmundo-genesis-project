import { describe, expect, it } from "vitest";
import { allocateFanTiers, calculateChemistryContribution, calculateFame, calculateFestivalFans, calculateMemberXp, isCompletedSong, normalisePerformanceScore, stableReference } from "../live-performance-progression";
describe("shared live performance progression", () => {
 it("is deterministic and allocates every fan exactly once", () => { expect(calculateFestivalFans(1000,88,100,1)).toEqual(calculateFestivalFans(1000,88,100,1)); expect(allocateFanTiers(101,22)).toEqual({total:101,casual:51,dedicated:35,superfans:15}); });
 it("calculates bounded fame and XP and rejects absence", () => { expect(calculateFame(100,5000)).toBe(7); expect(calculateMemberXp(80,"present")).toBe(16); expect(calculateMemberXp(80,"late")).toBe(16); expect(calculateMemberXp(80,"missing")).toBe(0); });
 it("calculates chemistry and song eligibility", () => { expect(calculateChemistryContribution(75)).toBe(1); expect(calculateChemistryContribution(39)).toBe(-1); expect(isCompletedSong(["played"],"skipped")).toBe(false); });
 it("generates source-scoped stable references", () => { expect(stableReference("festival_performance","p","member_xp","m")).toBe("festival-performance:p:member_xp:m"); });
 it("mirrors SQL score normalisation for both supported scales and boundaries", () => {
   expect(normalisePerformanceScore(0, 0, 25)).toBe(0);
   expect(normalisePerformanceScore(25, 0, 25)).toBe(100);
   expect(normalisePerformanceScore(12.5, 0, 25)).toBe(50);
   expect(normalisePerformanceScore(50, 0, 100)).toBe(50);
   expect(() => normalisePerformanceScore(26, 0, 25)).toThrow("LIVE_PERFORMANCE_SCORE_OUT_OF_RANGE");
   expect(() => normalisePerformanceScore(0, 1, 1)).toThrow("LIVE_PERFORMANCE_SCORE_OUT_OF_RANGE");
 });
});
