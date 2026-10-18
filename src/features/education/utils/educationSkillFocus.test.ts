import { describe, expect, it } from "vitest";
import { matchesEducationSkillFocus } from "./educationSkillFocus";
import { isEducationSkillVisible } from "./educationVisibility";

const contentForLearning = [
  { slug: "guitar", kind: "book" },
  { slug: "guitar_mastery", kind: "book" },
  { slug: "bass", kind: "university" },
  { slug: "guitar", kind: "university" },
  { slug: "bass", kind: "video" },
  { slug: "guitar", kind: "video" },
  { slug: "guitar", kind: "mentor" },
  { slug: "guitar_mastery", kind: "mentor" },
];

describe("skill-first education focus", () => {
  it("only lists entries whose skill slug exactly matches the selected skill", () => {
    const rows = contentForLearning.filter((item) => matchesEducationSkillFocus(item.slug, "guitar"));
    expect(rows.map((item) => item.kind)).toEqual(["book", "university", "video", "mentor"]);
  });

  it("preserves normal catalogue browsing when there is no focus", () => {
    expect(contentForLearning.filter((item) => matchesEducationSkillFocus(item.slug, null))).toHaveLength(8);
  });

  it("does not mistake mastery or a similarly named skill for basic", () => {
    expect(matchesEducationSkillFocus("guitar_mastery", "guitar")).toBe(false);
    expect(matchesEducationSkillFocus("guitar", "guitar_mastery")).toBe(false);
    expect(matchesEducationSkillFocus("professional_guitar", "guitar")).toBe(false);
  });

  it("never exposes locked resources even with an exact deep link", () => {
    const granted = new Map([["guitar", true], ["guitar_mastery", false]]);
    const rows = contentForLearning.filter((item) => isEducationSkillVisible(item.slug, granted) && matchesEducationSkillFocus(item.slug, "guitar_mastery"));
    expect(rows).toEqual([]);
  });

  it("requires matching resource skill for a focussed lesson, including nullable general videos", () => {
    expect(matchesEducationSkillFocus(null, "guitar")).toBe(false);
    expect(matchesEducationSkillFocus(undefined, null)).toBe(true);
  });
});
