import { describe, expect, it } from "vitest";
import { applyDailyWellnessDrift, calculateOverallWellness, createDefaultWellnessCore, getPerformanceModifier, getWellnessState, getWellnessTier, getWellnessWarnings, isWellnessActivityUnlocked, isWellnessStatUnlocked, validateWellnessScheduleWindow } from "./wellnessSystem";

describe("wellness calculations", () => {
  it("derives excellent and critical overall wellness from underlying stats", () => {
    expect(calculateOverallWellness({ energy: 95, physical_health: 95, happiness: 90, stress: 10, fatigue: 8, sleep_quality: 90, nutrition: 85, fitness: 80, motivation: 92, burnout_risk: 5 })).toBeGreaterThanOrEqual(85);
    expect(calculateOverallWellness({ energy: 10, physical_health: 20, happiness: 15, stress: 95, fatigue: 95, sleep_quality: 10, nutrition: 20, fitness: 20, motivation: 10, burnout_risk: 90 })).toBeLessThan(30);
  });

  it("applies state thresholds consistently", () => {
    expect(getWellnessState(90)).toBe("Excellent");
    expect(getWellnessState(75)).toBe("Good");
    expect(getWellnessState(55)).toBe("Stable");
    expect(getWellnessState(35)).toBe("Struggling");
    expect(getWellnessState(10)).toBe("Critical");
  });

  it("caps performance modifiers and handles missing migration data", () => {
    expect(getPerformanceModifier(null)).toBe(1);
    expect(getPerformanceModifier({ energy: 100, physical_health: 100, happiness: 100, stress: 0, fatigue: 0, sleep_quality: 100, nutrition: 100, fitness: 100, motivation: 100, burnout_risk: 0 })).toBeLessThanOrEqual(1.08);
    expect(getPerformanceModifier({ energy: 1, physical_health: 1, happiness: 1, stress: 100, fatigue: 100, sleep_quality: 1, nutrition: 1, fitness: 1, motivation: 1, burnout_risk: 100 })).toBe(0.65);
  });

  it("calculates burnout warnings from behaviour-linked values", () => {
    const warnings = getWellnessWarnings({ ...createDefaultWellnessCore(), stress: 90, fatigue: 85, burnout_risk: 80 });
    expect(warnings.map((w) => w.key)).toContain("burnout");
    expect(warnings[0].severity).toBeGreaterThanOrEqual(warnings[warnings.length - 1].severity);
  });

  it("applies daily drift idempotent inputs without leaving bounds", () => {
    const next = applyDailyWellnessDrift({ ...createDefaultWellnessCore(), energy: 98, stress: 1, fatigue: 1 }, 480);
    expect(next.energy).toBeLessThanOrEqual(100);
    expect(next.fatigue).toBeGreaterThanOrEqual(0);
  });
});

describe("wellness gating", () => {
  it("unlocks tiers and stats by existing fame progression", () => {
    expect(getWellnessTier(0)).toBe("new_artist");
    expect(getWellnessTier(100)).toBe("active_musician");
    expect(getWellnessTier(1000)).toBe("professional_artist");
    expect(isWellnessStatUnlocked("burnout_risk", 999)).toBe(false);
    expect(isWellnessStatUnlocked("burnout_risk", 1000)).toBe(true);
  });

  it("rejects locked activity access server config can mirror", () => {
    expect(isWellnessActivityUnlocked("exercise", 0)).toBe(false);
    expect(isWellnessActivityUnlocked("exercise", 100)).toBe(true);
  });
});


describe("wellness scheduling validation", () => {
  const now = new Date("2026-07-12T12:00:00Z");

  it("rejects past and invalid wellness bookings", () => {
    expect(validateWellnessScheduleWindow({ startsAt: new Date("2026-07-12T11:59:00Z"), endsAt: new Date("2026-07-12T13:00:00Z"), now })).toEqual({ ok: false, reason: "past" });
    expect(validateWellnessScheduleWindow({ startsAt: new Date("2026-07-12T13:00:00Z"), endsAt: new Date("2026-07-12T13:00:00Z"), now })).toEqual({ ok: false, reason: "invalid_duration" });
  });

  it("rejects active overlaps but allows non-blocking statuses and overlap-enabled activities", () => {
    const existing = [{ startsAt: new Date("2026-07-12T13:00:00Z"), endsAt: new Date("2026-07-12T14:00:00Z"), status: "scheduled" }];
    expect(validateWellnessScheduleWindow({ startsAt: new Date("2026-07-12T13:30:00Z"), endsAt: new Date("2026-07-12T14:30:00Z"), existing, now })).toEqual({ ok: false, reason: "overlap" });
    expect(validateWellnessScheduleWindow({ startsAt: new Date("2026-07-12T13:30:00Z"), endsAt: new Date("2026-07-12T14:30:00Z"), existing, canOverlap: true, now })).toEqual({ ok: true });
    expect(validateWellnessScheduleWindow({ startsAt: new Date("2026-07-12T13:30:00Z"), endsAt: new Date("2026-07-12T14:30:00Z"), existing: [{ ...existing[0], status: "cancelled" }], now })).toEqual({ ok: true });
  });
});
