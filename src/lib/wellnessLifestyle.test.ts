import { describe, expect, it } from "vitest";
import { calculatePartyResult, calculateSleepResult, deriveLifestyleProfile } from "./wellnessLifestyle";

const day = (i: number, overrides = {}) => ({ day: `2026-07-${String(i).padStart(2,"0")}`, sleepMinutes: 480, effectiveSleepMinutes: 460, sleepStartHour: 23, restMinutes: 80, exerciseMinutes: 30, nutritionScore: 72, hydrationScore: 74, socialMinutes: 40, partyMinutes: 0, alcoholUnits: 0, workloadMinutes: 240, ...overrides });

describe("wellness lifestyle sleep debt", () => {
  it("keeps adequate sleep from creating debt", () => {
    const result = calculateSleepResult({ durationMinutes: 560, previousDebt: 10, accommodationQuality: 90 });
    expect(result.nextDebt).toBeLessThanOrEqual(10);
    expect(result.quality).toBeGreaterThan(70);
  });

  it("accumulates bounded debt across poor nights and recovers gradually", () => {
    let debt = 0;
    for (let i = 0; i < 5; i++) debt = calculateSleepResult({ durationMinutes: 240, previousDebt: debt, alcoholExposure: 15 }).nextDebt;
    expect(debt).toBeGreaterThan(40);
    expect(debt).toBeLessThanOrEqual(100);
    const recovered = calculateSleepResult({ durationMinutes: 620, previousDebt: debt, accommodationQuality: 90 }).nextDebt;
    expect(recovered).toBeLessThan(debt);
    expect(debt - recovered).toBeLessThanOrEqual(16);
  });

  it("travel and alcohol reduce effective sleep quality", () => {
    const base = calculateSleepResult({ durationMinutes: 480, accommodationQuality: 80 });
    const rough = calculateSleepResult({ durationMinutes: 480, travelMinutes: 360, alcoholExposure: 45, accommodationQuality: 45 });
    expect(rough.quality).toBeLessThan(base.quality);
    expect(rough.causes).toContain("alcohol disrupted sleep");
  });
});

describe("wellness lifestyle partying and alcohol", () => {
  it("higher intensity increases both benefits and costs", () => {
    const quiet = calculatePartyResult("quiet", { sober: true });
    const heavy = calculatePartyResult("heavy");
    expect(heavy.happiness).toBeGreaterThan(quiet.happiness);
    expect(heavy.fatigue).toBeGreaterThan(quiet.fatigue);
    expect(heavy.sleepDisruption).toBeGreaterThan(quiet.sleepDisruption);
  });

  it("sober participation remains socially viable with lower alcohol costs", () => {
    const sober = calculatePartyResult("lively", { sober: true });
    const standard = calculatePartyResult("lively");
    expect(sober.networkingChance).toBeGreaterThan(0);
    expect(sober.relationshipChance).toBeGreaterThan(0);
    expect(sober.alcoholExposure).toBeLessThan(standard.alcoholExposure);
    expect(sober.sleepDisruption).toBeLessThan(standard.sleepDisruption);
  });

  it("repeated identical events receive diminishing rewards", () => {
    const first = calculatePartyResult("casual");
    const repeated = calculatePartyResult("casual", { repeatedSimilarCount: 4 });
    expect(repeated.networkingChance).toBeLessThan(first.networkingChance);
    expect(repeated.happiness).toBeLessThan(first.happiness);
  });
});

describe("wellness lifestyle burnout and traits", () => {
  it("derives balanced states from rolling windows, not one bad day", () => {
    const profile = deriveLifestyleProfile([1,2,3,4,5,6].map(day).concat(day(7, { sleepMinutes: 260, effectiveSleepMinutes: 230, partyMinutes: 180, alcoholUnits: 3 })));
    expect(["Highly balanced", "Balanced", "Busy", "Unstable"]).toContain(profile.state);
    expect(profile.burnout_stage).not.toBe("Severe burnout");
  });

  it("sustained overwork creates burnout pressure and workaholic progress", () => {
    const profile = deriveLifestyleProfile(Array.from({ length: 28 }, (_, i) => day(i + 1, { sleepMinutes: 330, effectiveSleepMinutes: 300, restMinutes: 10, workloadMinutes: 690, travelMinutes: 120 })));
    expect(profile.burnout_pressure).toBeGreaterThan(55);
    expect(profile.traits.find(t => t.slug === "workaholic")?.progress).toBeGreaterThan(0);
    expect(profile.recommendation).toMatch(/rest|sleep|downtime/i);
  });
});
