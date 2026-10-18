import { describe, expect, it } from "vitest";
import { getEducationSkillCap } from "./educationSkillCaps";

describe("production education skill level caps", () => {
  it("keeps original foundational skills at level 100, regardless of legacy metadata", () => {
    for (const slug of ["guitar", "vocals", "drums", "bass", "performance", "songwriting", "composition", "technical"]) {
      expect(getEducationSkillCap(slug, {})).toBe(100);
      expect(getEducationSkillCap(slug, { max_level: 20 })).toBe(100);
    }
  });

  it("defaults tiered skills to level 20 when legacy tier_caps only describes XP", () => {
    expect(getEducationSkillCap("guitar_mastery", { "1": 100, "2": 200, "3": 400 })).toBe(20);
    expect(getEducationSkillCap("professional_mixing_mastering", null)).toBe(20);
  });

  it("respects configured caps for newer tiers", () => {
    expect(getEducationSkillCap("tattooing_mastery", { max_level: 30 })).toBe(30);
    expect(getEducationSkillCap("professional_djing", { max_level: 20 })).toBe(20);
  });

  it("rejects malformed cap overrides", () => {
    expect(getEducationSkillCap("mastery_djing", { max_level: "100" })).toBe(20);
    expect(getEducationSkillCap("mastery_djing", { max_level: -1 })).toBe(1);
  });
});
