import { describe, expect, it } from "vitest";
import { allocateFanTiers, calculateChemistryContribution, calculateChemistryImpact, calculateFame, calculateFestivalFans, calculateMemberXp, calculateSongFamiliarityMinutes, calculateSongPopularity, isCompletedSong, normalisePerformanceScore, stableReference } from "../live-performance-progression";
describe("shared live performance progression", () => {
 it("is deterministic and allocates every fan exactly once", () => { expect(calculateFestivalFans(1000,88,100,1)).toEqual(calculateFestivalFans(1000,88,100,1)); expect(allocateFanTiers(101,22)).toEqual({total:101,casual:51,dedicated:35,superfans:15}); });
 it("calculates bounded fame and XP and rejects absence", () => { expect(calculateFame(100,5000)).toBe(7); expect(calculateMemberXp(80,"present")).toBe(16); expect(calculateMemberXp(80,"late")).toBe(16); expect(calculateMemberXp(80,"missing")).toBe(0); });
 it("calculates chemistry and song eligibility", () => { expect(calculateChemistryContribution(75)).toBe(1); expect(calculateChemistryContribution(39)).toBe(-1); expect(isCompletedSong(["played"],"skipped")).toBe(false); });
 it.each([
   ["excellent", 100, 5000, "present", true], ["good", 80, 1000, "late", true],
   ["average", 55, 200, "present", true], ["poor", 20, 50, "present", true],
   ["zero audience", 75, 0, "present", true], ["absent", 75, 1000, "absent", true],
   ["skipped song", 75, 1000, "present", false],
 ] as const)("matches versioned SQL fixture: %s", (_name, score, audience, attendance, completed) => {
   expect(calculateMemberXp(score, attendance)).toBe(attendance === "absent" ? 0 : Math.min(100, Math.max(1, Math.round(score / 5))));
   expect(calculateChemistryImpact(score, attendance)).toEqual(attendance === "absent" ? {} : { familiarity: 2, trust: 2, performance_chemistry: score >= 75 ? 4 : 2, reliability_confidence: attendance === "late" ? 0 : 1 });
   expect(calculateSongFamiliarityMinutes(score, completed)).toBe(completed ? Math.min(10, Math.max(1, Math.round(score / 20))) : 0);
   expect(calculateSongPopularity(score, audience, completed)).toBe(completed ? Math.min(10, Math.max(0, Math.round((score - 50) / 10) + (audience >= 1000 ? 1 : 0))) : 0);
 });
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
