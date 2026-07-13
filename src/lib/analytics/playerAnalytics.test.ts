import { describe, expect, it } from "vitest";
import { buildSafeComparison, createRecommendations, filterMeaningfulTimelineEvents, isPeerBenchmarkAvailable, resolveAnalyticsRange, summarizeTrend } from "./playerAnalytics";

describe("player analytics helpers", () => {
  it("uses stable UTC boundaries and aggregates long ranges", () => {
    expect(resolveAnalyticsRange("7d", new Date("2026-07-13T15:30:00Z"))).toEqual({ start: "2026-07-07T00:00:00.000Z", end: "2026-07-14T00:00:00.000Z", useAggregates: false });
    expect(resolveAnalyticsRange("career", new Date("2026-07-13T15:30:00Z"))).toEqual({ start: null, end: "2026-07-14T00:00:00.000Z", useAggregates: true });
  });

  it("does not create a trend from one data point", () => {
    const trend = summarizeTrend([{ id: "one", occurredAt: "2026-07-10T00:00:00Z", value: 71, calculationVersion: "v1" }], "gig");
    expect(trend.label).toBe("Not enough data");
    expect(trend.direction).toBe("unknown");
    expect(trend.delta).toBeNull();
  });

  it("labels small and larger samples with confidence and version warnings", () => {
    expect(summarizeTrend([
      { id: "a", occurredAt: "2026-07-01T00:00:00Z", value: 50, calculationVersion: "v1" },
      { id: "b", occurredAt: "2026-07-02T00:00:00Z", value: 54, calculationVersion: "v1" },
    ]).label).toBe("Low confidence");
    const trend = summarizeTrend(Array.from({ length: 6 }, (_, index) => ({ id: String(index), occurredAt: `2026-07-0${index + 1}T00:00:00Z`, value: 50 + index * 2, calculationVersion: index < 3 ? "v1" : "v2" })), "recording");
    expect(trend.label).toBe("Strong trend");
    expect(trend.versionWarning).toBe(true);
  });

  it("rejects incompatible outcome comparisons and warns on version changes", () => {
    expect(buildSafeComparison({ systemKey: "gig", calculationVersion: "v1" }, { systemKey: "recording", calculationVersion: "v1" }).compatible).toBe(false);
    expect(buildSafeComparison({ systemKey: "gig", calculationVersion: "v1" }, { systemKey: "gig", calculationVersion: "v2" }).warning).toContain("Scoring changed");
  });

  it("keeps timeline events meaningful and ordered", () => {
    const events = filterMeaningfulTimelineEvents([
      { id: "xp", occurredAt: "2026-07-01T00:00:00Z", category: "skill", title: "XP", summary: "small", significance: "minor" },
      { id: "level", occurredAt: "2026-07-03T00:00:00Z", category: "skill", title: "Level", summary: "up", significance: "meaningful" },
      { id: "gig", occurredAt: "2026-07-02T00:00:00Z", category: "gig", title: "Gig", summary: "best", significance: "milestone" },
    ]);
    expect(events.map((event) => event.id)).toEqual(["level", "gig"]);
  });

  it("requires repeated accessible recommendation evidence and applies privacy-safe cohorts", () => {
    expect(createRecommendations([{ id: "r", actionKey: "rehearse", evidenceCount: 2, isAccessible: true, isDismissed: false, versionStable: true, consistency: 0.9, recencyDays: 3, explanation: "x" }])).toHaveLength(0);
    expect(createRecommendations([{ id: "r", actionKey: "rehearse", evidenceCount: 5, isAccessible: true, isDismissed: false, versionStable: true, consistency: 0.9, recencyDays: 3, explanation: "Repeated low readiness before gigs." }])[0].confidence).toBe("High confidence");
    expect(isPeerBenchmarkAvailable({ cohortSize: 24 })).toBe(false);
    expect(isPeerBenchmarkAvailable({ cohortSize: 30, containsHiddenSkill: true })).toBe(false);
    expect(isPeerBenchmarkAvailable({ cohortSize: 30 })).toBe(true);
  });
});
