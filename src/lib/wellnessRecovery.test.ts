import { describe, expect, it } from "vitest";
import { calculateTourLoadState, calculateTravelFatigueEffect, forecastWellnessAfterRecovery, getTransportWellnessProfile, resolveAccommodationRecoveryProfile } from "./wellnessRecovery";

describe("wellness accommodation and travel recovery", () => {
  it("applies standard, premium and poor accommodation within caps", () => {
    const basic = resolveAccommodationRecoveryProfile({ kind: "hotel", tier: "basic", occupied: true });
    const premium = resolveAccommodationRecoveryProfile({ kind: "hotel", tier: "premium", quality: 90, occupied: true });
    const none = resolveAccommodationRecoveryProfile(null);
    expect(basic.energy_recovery_modifier).toBe(0);
    expect(premium.energy_recovery_modifier).toBeLessThanOrEqual(0.2);
    expect(premium.sleep_quality_modifier).toBeGreaterThan(basic.sleep_quality_modifier);
    expect(none.sleep_quality_modifier).toBeLessThan(0);
  });

  it("home familiarity reduces stress and missing accommodation is safe", () => {
    const home = resolveAccommodationRecoveryProfile({ kind: "home", tier: "standard", isHomeCity: true, quality: 65, upgrades: ["better_bed"] });
    const missing = resolveAccommodationRecoveryProfile(undefined);
    expect(home.stress_recovery_modifier).toBeGreaterThan(0.1);
    expect(home.facilities).toContain("familiar space");
    expect(missing.tier).toBe("none");
  });

  it("longer journeys create more fatigue and better transport reduces it", () => {
    const van = calculateTravelFatigueEffect({ id: "a", durationHours: 10, distanceKm: 700, vehicleTier: "rusty_van" }, { energy: 80, fatigue: 20 });
    const coach = calculateTravelFatigueEffect({ id: "b", durationHours: 10, distanceKm: 700, vehicleTier: "full_tour_bus", upgrades: ["sleeping_bunks"] }, { energy: 80, fatigue: 20 });
    const short = calculateTravelFatigueEffect({ id: "c", durationHours: 1, distanceKm: 40, vehicleTier: "rusty_van" }, { energy: 80, fatigue: 20 });
    expect(van.fatigueDelta).toBeGreaterThan(coach.fatigueDelta);
    expect(coach.partialSleepHours).toBeGreaterThan(0);
    expect(short.fatigueDelta).toBeLessThan(4);
  });

  it("travel effects are idempotent", () => {
    const first = calculateTravelFatigueEffect({ id: "leg-1", durationHours: 6, distanceKm: 300, vehicleTier: "minivan" });
    const second = calculateTravelFatigueEffect({ id: "leg-1", durationHours: 6, distanceKm: 300, vehicleTier: "minivan", alreadyProcessedIds: [first.idempotencyKey] });
    expect(first.processed).toBe(true);
    expect(second.processed).toBe(false);
    expect(second.fatigueDelta).toBe(0);
  });

  it("tour load increases with consecutive gigs and rest days reduce it", () => {
    const hard = calculateTourLoadState({ travelHours: 26, distanceKm: 1800, consecutiveNightsAway: 7, consecutiveGigs: 5, restDays: 0, accommodationScore: 25, transportComfort: 20 });
    const rested = calculateTourLoadState({ travelHours: 26, distanceKm: 1800, consecutiveNightsAway: 7, consecutiveGigs: 5, restDays: 2, accommodationScore: 75, transportComfort: 70 });
    expect(hard.score).toBeGreaterThan(rested.score);
    expect(["exhausting", "unsustainable"]).toContain(hard.state);
  });

  it("forecasts are read-only estimates and rest improves predicted readiness", () => {
    const poor = resolveAccommodationRecoveryProfile({ kind: "none", tier: "none" });
    const home = resolveAccommodationRecoveryProfile({ kind: "home", tier: "premium", quality: 85, isHomeCity: true });
    const current = { energy: 45, fatigue: 70, stress: 65 };
    const poorForecast = forecastWellnessAfterRecovery(current, poor, undefined, 0);
    const restForecast = forecastWellnessAfterRecovery(current, home, undefined, 1);
    expect(restForecast.readiness).toBeGreaterThan(poorForecast.readiness);
    expect(current.energy).toBe(45);
  });

  it("transport upgrades improve sleep and cap duplicate upgrade effect", () => {
    const base = getTransportWellnessProfile("sprinter");
    const upgraded = getTransportWellnessProfile("sprinter", ["sleeping_bunks", "premium_mattresses", "soundproofing"]);
    expect(upgraded.sleep_capability).toBeGreaterThan(base.sleep_capability);
    expect(upgraded.noise).toBeLessThan(base.noise);
    expect(upgraded.sleep_capability).toBeLessThanOrEqual(100);
  });
});
