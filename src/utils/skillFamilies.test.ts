import { describe, expect, it } from "vitest";
import { groupSkillFamilies, resolveSkillTier, skillFamilyKey } from "./skillFamilies";

describe("skill family grouping", () => {
  it("groups tier variants without changing unrelated slug parts", () => {
    expect(skillFamilyKey("instruments_basic_singing")).toBe("instruments_singing");
    expect(skillFamilyKey("instruments_professional_singing")).toBe("instruments_singing");
    expect(skillFamilyKey("instruments_mastery_singing")).toBe("instruments_singing");
    expect(skillFamilyKey("professionalism")).toBe("professionalism");
  });

  it("prefers canonical tier metadata over legacy slug inference", () => {
    expect(resolveSkillTier("singing", "mastery")).toBe("mastery");
    expect(resolveSkillTier("instruments_professional_singing")).toBe("professional");
    expect(resolveSkillTier("singing")).toBe("basic");
  });

  it("sorts tiers and counts maxed skills using configured caps", () => {
    const families = groupSkillFamilies([
      { slug: "instruments_mastery_singing", name: "Mastery Singing", tier: "mastery", level: 0, maxLevel: 30 },
      { slug: "instruments_basic_singing", name: "Basic Singing", tier: "basic", level: 10, maxLevel: 10 },
      { slug: "instruments_professional_singing", name: "Professional Singing", tier: "professional", level: 8, maxLevel: 20 },
    ]);
    expect(families).toHaveLength(1);
    expect(families[0].skills.map((skill) => skill.tier)).toEqual(["basic", "professional", "mastery"]);
    expect(families[0].completed).toBe(1);
  });
});
