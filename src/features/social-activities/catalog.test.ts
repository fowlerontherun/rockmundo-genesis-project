import { describe, expect, it } from "vitest";
import { SOCIAL_ACTIVITY_CATALOG, calculateActivityQuality, calculateGroupScaling, calculateRepetitionMultiplier, estimatePersonalCost, getSocialActivityDefinition } from "./catalog";
describe("social activity catalogue", () => {
  it("contains all initial activity types with central balancing fields", () => { expect(SOCIAL_ACTIVITY_CATALOG).toHaveLength(22); expect(getSocialActivityDefinition("coffee")).toMatchObject({ minimum_participants: 2, maximum_participants: 2, base_cost: 6 }); expect(getSocialActivityDefinition("conflict_resolution")?.conflict_effect).toBeLessThan(0); });
  it("applies diminishing returns and group scaling", () => { expect(calculateRepetitionMultiplier(0)).toBe(1); expect(calculateRepetitionMultiplier(2)).toBeLessThan(0.3); expect(calculateGroupScaling(8)).toBeLessThan(calculateGroupScaling(2)); });
  it("estimates participant costs by payment model", () => { const meal = getSocialActivityDefinition("meal")!; expect(estimatePersonalCost(meal, "split", 4)).toBe(20); expect(estimatePersonalCost(meal, "host", 4)).toBe(0); });
  it("calculates quality bands from attendance and context", () => { expect(calculateActivityQuality({ attendanceRate: 1, groupSize: 3, repetitionMultiplier: 1, averageEnergy: 80, averageStress: 10, random: 10 })).toBe("great"); expect(calculateActivityQuality({ attendanceRate: 0.25, groupSize: 9, repetitionMultiplier: 0.05, averageEnergy: 10, averageStress: 90, random: -5 })).toBe("awkward"); });
});
