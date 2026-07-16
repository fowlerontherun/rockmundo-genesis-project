import { describe, expect, it } from "vitest";
import { aggregatePerformanceScore, calculateSongScore, crowdStateForScore, enforceStageCapacity, fanConversionEstimate, publicOutcomeIsPrivateSafe, reconcileCohortTotal, scoreReadiness } from "../model";

describe("festival audience and outcome model", () => {
  it("reconciles aggregate cohorts and enforces capacity", () => { expect(reconcileCohortTotal({ local: 10, travelling: 5.8, bad: -2 })).toBe(15); expect(enforceStageCapacity(120, 100)).toEqual({ audience: 100, overcrowded: true }); });
  it("scores readiness, songs and aggregate outcomes deterministically", () => { const readiness = scoreReadiness("ready"); const song = calculateSongScore({ readinessScore: readiness, crowdFit: 80, baseSkill: 75, incidentPenalty: 4, pacingBonus: 2, variation: 1 }); expect(song).toBeGreaterThan(70); expect(aggregatePerformanceScore([song, song - 10], readiness, 3, 1)).toBeGreaterThan(60); });
  it("represents skipped songs, incident penalties and audience conversion", () => { expect(calculateSongScore({ readinessScore: 90, crowdFit: 90, baseSkill: 80, skipped: true })).toBe(20); expect(fanConversionEstimate(1000, 90)).toMatchObject({ newCasualFans: 35, newEngagedFans: 13, newDedicatedFans: 1, lostFans: 0 }); });
  it("maps crowd response states and protects public privacy", () => { expect(crowdStateForScore(92)).toBe("ecstatic"); expect(crowdStateForScore(30)).toBe("bored"); expect(publicOutcomeIsPrivateSafe({ audience_size: 100, calculation_seed: "hidden" })).toBe(false); expect(publicOutcomeIsPrivateSafe({ audience_size: 100, performance_score: 80 })).toBe(true); });
});
