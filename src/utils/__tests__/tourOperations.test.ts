import { describe, expect, it } from "vitest";
import { buildTourHQ, calculateTourBudget, completeTourReport, generateTourEvent, validateTourSchedule, type TourOperationsInput } from "../tourOperations";

const input: TourOperationsInput = {
  tourId: "tour-1",
  bandFame: 12000,
  bandFans: 25000,
  currentCityId: "nyc",
  vehicleTier: "sprinter",
  startingBudget: 5000,
  accommodationQuality: "standard",
  restDays: ["2026-08-03"],
  completedStopIds: ["show-1"],
  merch: { startingStock: 300, unitCost: 8, unitPrice: 25, shippingCost: 120, storageCostPerDay: 5 },
  sponsorObligations: [
    { id: "sp-1", type: "meet_fans", value: 500, completed: true },
    { id: "sp-2", type: "social_post", value: 250 },
  ],
  crew: [
    { id: "crew-1", name: "Mara", role: "tour_manager", dailyCost: 120, fatigue: 35, morale: 72, experience: 60, hasAccommodation: true },
    { id: "crew-2", name: "Lee", role: "sound_engineer", dailyCost: 100, fatigue: 70, morale: 64, experience: 50, realPlayer: true },
  ],
  equipment: [
    { id: "eq-1", name: "Main guitar rig", role: "guitar", weight: 80, condition: 82, replacementCost: 1200 },
    { id: "eq-2", name: "Spare amp", role: "amplifier", weight: 45, condition: 68, replacementCost: 700, isSpare: true },
  ],
  stops: [
    { id: "show-1", cityId: "nyc", cityName: "New York", region: "NY", country: "US", venueId: "v1", venueName: "Mercury Hall", capacity: 500, scheduledAt: "2026-08-01T20:00:00Z", setupHours: 3, breakdownHours: 2, guarantee: 500, doorSplit: 0.6, ticketPrice: 30, status: "completed", rating: 82, crowdEnergy: 78, ticketsSold: 420 },
    { id: "show-2", cityId: "bos", cityName: "Boston", region: "MA", country: "US", venueId: "v2", venueName: "Harbor Club", capacity: 650, scheduledAt: "2026-08-03T20:00:00Z", distanceFromPreviousKm: 350, setupHours: 4, breakdownHours: 2, guarantee: 650, doorSplit: 0.55, ticketPrice: 28 },
    { id: "show-3", cityId: "phl", cityName: "Philadelphia", region: "PA", country: "US", venueId: "v3", venueName: "Foundry", capacity: 700, scheduledAt: "2026-08-05T20:00:00Z", distanceFromPreviousKm: 500, setupHours: 4, breakdownHours: 2, guarantee: 700, doorSplit: 0.55, ticketPrice: 28 },
  ],
};

describe("tour operations", () => {
  it("calculates rolling budgets with income and cost categories", () => {
    const budget = calculateTourBudget(input);
    expect(budget.income.ticketGuarantees).toBe(500);
    expect(budget.income.merchandise).toBeGreaterThan(0);
    expect(budget.costs.hotels).toBeGreaterThan(0);
    expect(budget.costs.crewWages).toBeGreaterThan(0);
    expect(budget.rollingBudget).toBe(input.startingBudget! + budget.profit);
  });

  it("validates impossible schedules instead of allowing teleporting", () => {
    const issues = validateTourSchedule([
      input.stops[0]!,
      { ...input.stops[1]!, scheduledAt: "2026-08-01T22:00:00Z", distanceFromPreviousKm: 900 },
    ], "rusty_van");
    expect(issues.some((issue) => issue.code === "overlap" || issue.code === "travel_time")).toBe(true);
  });

  it("builds a Tour HQ summary covering logistics, fatigue, morale, merch, sponsor and stats", () => {
    const hq = buildTourHQ(input);
    expect(hq.currentCity).toBe("New York");
    expect(hq.nextVenue).toBe("Harbor Club");
    expect(hq.remainingShows).toBe(2);
    expect(hq.crew.total).toBe(2);
    expect(hq.crew.fatigued).toBe(1);
    expect(hq.equipment.spares).toBe(1);
    expect(hq.merchandise.sold).toBeGreaterThan(0);
    expect(hq.sponsorObligations.total).toBe(2);
    expect(hq.stats.distanceTravelledKm).toBe(850);
    expect(hq.wellnessForecast.tourLoadState).toMatch(/comfortable|active|demanding|exhausting|unsustainable/);
    expect(hq.wellnessForecast.estimatedGigReadiness).toBeGreaterThan(0);
  });

  it("generates contextual logistics events from cumulative risk", () => {
    const event = generateTourEvent({
      ...input,
      vehicleTier: "rusty_van",
      equipment: [{ id: "bad", name: "Broken synth", role: "keys", weight: 40, condition: 20, replacementCost: 1000 }],
      crew: input.crew.map((crew) => ({ ...crew, fatigue: 95 })),
    });
    expect(event).not.toBeNull();
    expect(event?.costImpact).toBeGreaterThanOrEqual(0);
  });

  it("produces end-of-tour reports and future planning modifiers", () => {
    const report = completeTourReport({ ...input, completedStopIds: ["show-1", "show-2", "show-3"] });
    expect(report.bestGig).toBe("Mercury Hall");
    expect(report.financialPerformance.totalIncome).toBeGreaterThan(0);
    expect(report.futurePlanning).toHaveProperty("bookingOfferModifier");
  });

  it("is idempotent for repeated HQ calculations", () => {
    expect(buildTourHQ(input)).toEqual(buildTourHQ(input));
  });
});
