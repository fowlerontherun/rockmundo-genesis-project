import { describe, expect, it } from "vitest";
import { PROGRESSION_BALANCE, getAttributeUpgradeCost, getBeginnerBonus, getCumulativeXpForSkillLevel, getLevelFromLifetimeXp, getProgressWithinLevel, getXpRequiredForLevel } from "../progressionBalance";
import { calculateWeightedLearningMultiplier } from "../skillCatalogue";

describe("progression balance v2", () => {
  it("uses increasing segmented XP curves without explosive elite totals", () => {
    const skill = { slug: "guitar", max_level: 100, progression_curve_key: "standard_role" };
    expect(getXpRequiredForLevel(skill, 1)).toBeGreaterThan(0);
    expect(getXpRequiredForLevel(skill, 50)).toBeGreaterThan(getXpRequiredForLevel(skill, 5));
    expect(getXpRequiredForLevel(skill, 100)).toBeLessThan(6000);
  });
  it("round-trips cumulative XP and level progress", () => {
    const skill = { slug: "vocals", max_level: 100, progression_curve_key: "foundation_fast" };
    const xp = getCumulativeXpForSkillLevel(skill, 10);
    expect(getLevelFromLifetimeXp(skill, xp)).toBe(10);
    expect(getProgressWithinLevel(skill, xp + 10).level).toBe(10);
  });
  it("caps diminishing learning bonuses", () => {
    const result = calculateWeightedLearningMultiplier("guitar", { musical_ability: 1000, musicality: 1000 }, [
      { skill_slug: "guitar", attribute_key: "musical_ability", relationship_type: "learning_speed", weight: 1, max_bonus: 0.5, is_primary: true },
      { skill_slug: "guitar", attribute_key: "musicality", relationship_type: "learning_speed", weight: 1, max_bonus: 0.5, is_primary: false },
    ]);
    expect(result.multiplier).toBeLessThanOrEqual(1 + PROGRESSION_BALANCE.learning.totalAttributeBonusCap);
  });
  it("ends beginner bonuses and increases attribute costs by band", () => {
    expect(getBeginnerBonus(0)).toBe(0.75);
    expect(getBeginnerBonus(5)).toBe(0);
    expect(getAttributeUpgradeCost(900)).toBeGreaterThan(getAttributeUpgradeCost(100));
  });
});
