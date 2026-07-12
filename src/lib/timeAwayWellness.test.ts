import { describe, expect, it } from "vitest";
import { buildRecommendedItinerary, calculateCareerMomentum, calculateCareerSustainability, calculateReturnReadiness, forecastTimeAway, TIME_AWAY_TYPES, validateTimeAwayRequest } from "./timeAwayWellness";

const vitals = { energy: 46, physical_health: 70, happiness: 58, stress: 76, fatigue: 72, sleep_quality: 42, nutrition: 63, fitness: 50, motivation: 48, burnout_risk: 82 };

describe("timeAwayWellness", () => {
  it("rejects past starts, locked options and missing server-sourced travel/accommodation", () => {
    const result = validateTimeAwayRequest({ type: "wellness_retreat", startDate: "2026-07-01", endDate: "2026-07-04", focus: "burnout_recovery", vitals, fame: 0 }, "2026-07-12");
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("past");
    expect(result.errors.join(" ")).toContain("locked");
    expect(result.errors.join(" ")).toContain("accommodation");
  });

  it("keeps staycations affordable and effective without instant burnout cures", () => {
    const forecast = forecastTimeAway({ type: "staycation", startDate: "2026-07-13", endDate: "2026-07-16", focus: "sleep_reset", vitals, fame: 0, accommodation: { kind: "home", tier: "standard", isHomeCity: true } });
    expect(forecast.valid).toBe(true);
    expect(forecast.totalCostCents).toBeLessThan(TIME_AWAY_TYPES.standard_holiday.baseCostCents);
    expect(forecast.wellness.burnout_risk).toBeGreaterThan(50);
    expect(forecast.wellness.burnout_risk).toBeLessThan(vitals.burnout_risk);
  });

  it("applies travel fatigue and gradual career momentum trade-offs", () => {
    const short = forecastTimeAway({ type: "city_break", startDate: "2026-07-13", endDate: "2026-07-14", focus: "social_enjoyment", vitals, fame: 0, accommodation: { kind: "hotel", tier: "standard", quality: 65 }, travel: { id: "leg-1", durationHours: 8, distanceKm: 900, vehicleTier: "minivan" } });
    const long = forecastTimeAway({ type: "career_break", startDate: "2026-08-01", endDate: "2026-09-15", focus: "burnout_recovery", vitals, fame: 2000, accommodation: { kind: "home", tier: "standard", isHomeCity: true } });
    expect(short.wellness.fatigue).toBeGreaterThan(35);
    expect(long.opportunityCost.careerMomentumDelta).toBeLessThan(short.opportunityCost.careerMomentumDelta);
    expect(long.opportunityCost.permanentFameProtected).toBe(true);
  });

  it("derives sustainability from aggregate workload and treats missing history safely", () => {
    const empty = calculateCareerSustainability({ gigs: 0, tourDays: 0, travelHours: 0, recordingHours: 0, rehearsalHours: 0, practiceHours: 0, restDays: 0, holidays: 0, activeConditionDays: 0, burnoutDays: 0, averageSleep: 0, averageRecoveryQuality: 0, windowDays: 90 });
    const overloaded = calculateCareerSustainability({ gigs: 18, tourDays: 42, travelHours: 130, recordingHours: 30, rehearsalHours: 50, practiceHours: 30, restDays: 2, holidays: 0, activeConditionDays: 8, burnoutDays: 12, averageSleep: 4, averageRecoveryQuality: 28, windowDays: 90 });
    expect(empty.legacySafe).toBe(true);
    expect(["sustainable", "healthy_workload"]).toContain(empty.state);
    expect(["at_risk", "unsustainable"]).toContain(overloaded.state);
  });

  it("builds capped itineraries and return readiness restrictions", () => {
    const itinerary = buildRecommendedItinerary("band_retreat", "creative_reset", 4);
    const readiness = calculateReturnReadiness(vitals, "gig");
    expect(itinerary).toHaveLength(4);
    expect(itinerary[0].scheduledRewardsDirectly).toBe(false);
    expect(readiness.severeRestriction).toBe(true);
  });

  it("keeps momentum separate from permanent fame", () => {
    const momentum = calculateCareerMomentum({ recentGigs: 0, recentReleases: 0, mediaActivity: 0, fanEngagement: 8, tourDays: 0, inactivityDays: 120 });
    expect(momentum.state).toBe("dormant");
    expect(momentum.permanentFameProtected).toBe(true);
  });
});
