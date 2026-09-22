import { describe, expect, it } from "vitest";

import { getEquivalentSkillLevel, getEquivalentSkillSlugs } from "./skillSlugAliases";

describe("skill slug aliases", () => {
  it("treats legacy Basic Punk Rock progress as the canonical genre skill", () => {
    const progress = [
      { skill_slug: "basic_punk_rock", current_level: 10 },
      { skill_slug: "genres_basic_punk_rock", current_level: 0 },
    ];

    expect(getEquivalentSkillLevel(progress, "genres_basic_punk_rock")).toBe(10);
    expect(getEquivalentSkillSlugs("genres_basic_punk_rock")).toContain("basic_punk_rock");
  });

  it("uses the highest level when both legacy and canonical rows exist", () => {
    const progress = [
      { skill_slug: "basic_punk_rock", current_level: 10 },
      { skill_slug: "genres_basic_punk_rock", current_level: 14 },
    ];

    expect(getEquivalentSkillLevel(progress, "genres_basic_punk_rock")).toBe(14);
  });

  it("supports legacy genre spellings that cannot be derived mechanically", () => {
    expect(getEquivalentSkillSlugs("genres_basic_r_and_b")).toContain("basic_rnb");
    expect(
      getEquivalentSkillLevel(
        [{ skill_slug: "basic_rnb", current_level: 7 }],
        "genres_basic_r_and_b",
      ),
    ).toBe(7);
  });

  it("does not alias unrelated non-genre skills", () => {
    expect(getEquivalentSkillSlugs("songwriting_basic_composing")).toEqual([
      "songwriting_basic_composing",
    ]);
  });
});
