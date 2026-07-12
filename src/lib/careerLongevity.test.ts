import { describe, expect, it } from "vitest";
import { calculateAgeModifiers, calculateCareerResilience, calculateCareerWear, calculateComebackReadiness, calculateExperienceScore, calculateLegacyProgression, calculateVeteranAdvantages, resolveCareerStage, validateMentoringEligibility } from "./careerLongevity";

const workload = { gigs: 2, tourDays: 4, travelHours: 8, recordingHours: 4, rehearsalHours: 6, practiceHours: 4, restDays: 5, holidays: 1, activeConditionDays: 0, burnoutDays: 0, averageSleep: 7, averageRecoveryQuality: 70, windowDays: 90 as const };

describe("career longevity", () => {
  it("uses career history rather than age alone for stage", () => {
    expect(resolveCareerStage({ biologicalAge: 70, activeMonthsOverride: 0, gigCount: 0 })).toBe("emerging");
    expect(resolveCareerStage({ activeMonthsOverride: 132, gigCount: 160, tourCount: 12, releaseCount: 8, recordingHours: 300, rehearsalHours: 400, fame: 20000 })).toBe("veteran");
  });

  it("caps age modifiers and lets fitness/support/preparation offset them", () => {
    const unsupported = calculateAgeModifiers(90);
    const supported = calculateAgeModifiers(90, { fitness: 80, professionalSupport: 70, preparation: 70 });
    expect(unsupported.recoverySpeedMultiplier).toBeGreaterThanOrEqual(0.82);
    expect(unsupported.strainRiskMultiplier).toBeLessThanOrEqual(1.14);
    expect(supported.recoverySpeedMultiplier).toBeGreaterThan(unsupported.recoverySpeedMultiplier);
  });

  it("gives bounded veteran advantages without replacing skill", () => {
    const adv = calculateVeteranAdvantages({ activeMonthsOverride: 240, gigCount: 500, tourCount: 50, releaseCount: 20, awards: 10, skillAverage: 80 });
    expect(adv.performanceConsistency).toBeLessThanOrEqual(0.12);
    expect(calculateExperienceScore({ activeMonthsOverride: 240, gigCount: 500 })).toBeLessThanOrEqual(100);
  });

  it("tracks active career wear while retaining historical totals", () => {
    const wear = calculateCareerWear({ ...workload, cumulativeTourLoad: 1000, cumulativePerformanceLoad: 1200, cumulativeRecoveryDays: 200 });
    expect(wear.historicalTotal).toBeGreaterThan(0);
    expect(wear.activeImpact).toBeLessThan(wear.historicalTotal + 20);
  });

  it("derives resilience from wellness, recovery and experience", () => {
    const wear = calculateCareerWear(workload);
    const res = calculateCareerResilience({ vitals: { fitness: 80, energy: 82, sleep_quality: 84, fatigue: 20, burnout_risk: 12, stress: 18 }, history: { activeMonthsOverride: 120, gigCount: 160, tourCount: 12 }, wear, professionalSupport: 65, lifestyleStability: 80 });
    expect(["stable", "resilient", "highly_resilient"]).toContain(res.state);
  });

  it("requires real preparation and minimum time away for comeback rewards", () => {
    const wear = calculateCareerWear(workload);
    const short = calculateComebackReadiness({ retirementState: "fully_retired", daysAway: 10, vitals: { energy: 80, fitness: 75, sleep_quality: 70, burnout_risk: 15 }, history: { activeMonthsOverride: 180, gigCount: 250, tourCount: 20 }, preparationScore: 80, wear });
    const prepared = calculateComebackReadiness({ ...short, retirementState: "fully_retired", daysAway: 90, vitals: { energy: 80, fitness: 75, sleep_quality: 70, burnout_risk: 15 }, history: { activeMonthsOverride: 180, gigCount: 250, tourCount: 20 }, preparationScore: 80, wear });
    expect(short.rewardEligible).toBe(false);
    expect(prepared.score).toBeGreaterThan(50);
  });

  it("rejects self mentoring and irrelevant mentors", () => {
    expect(validateMentoringEligibility({ mentorProfileId: "a", menteeProfileId: "a", mentor: { activeMonthsOverride: 180, gigCount: 200, tourCount: 20 }, focus: "performance", mentorRelevantSkill: 90 }).eligible).toBe(false);
    expect(validateMentoringEligibility({ mentorProfileId: "a", menteeProfileId: "b", mentor: { activeMonthsOverride: 180, gigCount: 200, tourCount: 20 }, focus: "production", mentorRelevantSkill: 20 }).eligible).toBe(false);
  });

  it("keeps legacy prestige contribution-based and not wealth-only", () => {
    expect(calculateLegacyProgression({ fame: 999999, activeMonthsOverride: 12, gigCount: 1 }).state).toBe("recognised");
    expect(calculateLegacyProgression({ activeMonthsOverride: 240, gigCount: 400, tourCount: 40, releaseCount: 25, awards: 20, mentoringMilestones: 20, reliableYears: 15 }).powerCreepProtected).toBe(true);
  });
});
