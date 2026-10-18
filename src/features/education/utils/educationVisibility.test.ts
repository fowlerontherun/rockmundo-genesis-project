import { describe, expect, it } from "vitest";
import { isEducationSkillVisible } from "./educationVisibility";
import { formatEducationSkillName, percentComplete } from "./educationUi";

describe("education catalogue tier visibility", () => {
  const access = new Map([
    ["instruments_basic_guitar", true],
    ["instruments_professional_guitar", false],
    ["instruments_mastery_guitar", false],
  ]);

  it("allows basic learning and general lessons", () => {
    expect(isEducationSkillVisible("instruments_basic_guitar", access)).toBe(true);
    expect(isEducationSkillVisible(null, access)).toBe(true);
  });

  it("conceals professional and mastery across every education catalogue", () => {
    const resources = [
      { skill_slug: "instruments_basic_guitar", id: "book" },
      { skill_slug: "instruments_professional_guitar", id: "university" },
      { skill_slug: "instruments_mastery_guitar", id: "video" },
    ];
    expect(resources.filter((resource) => isEducationSkillVisible(resource.skill_slug, access)).map((resource) => resource.id)).toEqual(["book"]);
  });

  it("hides unknown or unverified entries on failed/unfinished eligibility", () => {
    expect(isEducationSkillVisible("instruments_mastery_guitar", new Map())).toBe(false);
    expect(isEducationSkillVisible("new_professional_skill", access)).toBe(false);
  });

  it("shows advanced study only when the server explicitly unlocks it", () => {
    const afterUnlock = new Map(access);
    afterUnlock.set("instruments_professional_guitar", true);
    expect(isEducationSkillVisible("instruments_professional_guitar", afterUnlock)).toBe(true);
    expect(isEducationSkillVisible("instruments_mastery_guitar", afterUnlock)).toBe(false);
    afterUnlock.set("instruments_mastery_guitar", true);
    expect(isEducationSkillVisible("instruments_mastery_guitar", afterUnlock)).toBe(true);
  });
});

describe("education summary formatting", () => {
  it("shows readable skill names rather than raw slugs", () => {
    expect(formatEducationSkillName("instruments_basic_electric_guitar")).toBe("Electric Guitar");
    expect(formatEducationSkillName("genres_professional_heavy_metal")).toBe("Heavy Metal");
  });

  it("clamps attendance and reading progress", () => {
    expect(percentComplete(3, 5)).toBe(60);
    expect(percentComplete(100, 5)).toBe(100);
    expect(percentComplete(-2, 5)).toBe(0);
    expect(percentComplete(1, 0)).toBe(0);
  });
});
