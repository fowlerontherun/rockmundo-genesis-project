import { describe, expect, it } from "vitest";
import type { CanonicalSkill, SkillAvailability, SkillRoleLink } from "@/utils/skillCatalogue";
import { selectLearningRecommendations } from "./educationRecommendations";

const skill = (slug: string, maxLevel = 20): CanonicalSkill => ({
  id: slug,
  slug,
  name: slug.replace(/_/g, " "),
  description: "",
  category: "instrument",
  subcategory: null,
  tier: slug.includes("mastery") ? "mastery" : slug.includes("professional") ? "professional" : "basic",
  skill_type: "instrument",
  is_active: true,
  is_hidden: false,
  is_practiceable: true,
  is_foundational: true,
  max_level: maxLevel,
  progression_curve_key: "standard",
  display_order: 0,
  icon_key: null,
});

const catalogue = [
  skill("instruments_basic_guitar"),
  skill("instruments_professional_guitar"),
  skill("instruments_mastery_guitar"),
  skill("instruments_basic_drums"),
  skill("instruments_basic_bass"),
];

const availability: SkillAvailability[] = catalogue.map((entry) => ({
  slug: entry.slug,
  status: "available_to_unlock",
}));

const noRoleLinks: SkillRoleLink[] = [];

const recommend = (options: Partial<Parameters<typeof selectLearningRecommendations>[0]> = {}) =>
  selectLearningRecommendations({
    catalogue,
    progress: [],
    availability,
    roleLinks: noRoleLinks,
    access: new Map(catalogue.map((entry) => [entry.slug, entry.tier === "basic"])),
    goal: "all",
    limit: 10,
    ...options,
  });

describe("education next-learning recommendations", () => {
  it("never recommends advanced or mastery tiers before server unlock", () => {
    const slugs = recommend().map((entry) => entry.slug);
    expect(slugs).toContain("instruments_basic_guitar");
    expect(slugs).not.toContain("instruments_professional_guitar");
    expect(slugs).not.toContain("instruments_mastery_guitar");
  });

  it("makes a newly unlocked professional tier eligible, without leaking mastery", () => {
    const access = new Map(catalogue.map((entry) => [entry.slug, entry.tier === "basic" || entry.tier === "professional"]));
    const slugs = recommend({ access }).map((entry) => entry.slug);
    expect(slugs).toContain("instruments_professional_guitar");
    expect(slugs).not.toContain("instruments_mastery_guitar");
  });

  it("prioritises role-relevant skills ahead of unrelated study", () => {
    const ranked = recommend({ goal: "drummer" });
    expect(ranked[0].slug).toBe("instruments_basic_drums");
    expect(ranked[0].matchedGoal).toBe(true);
  });

  it("excludes maxed skills and undiscoverable prerequisites", () => {
    const ranked = recommend({
      progress: [{ skill_slug: "instruments_basic_guitar", current_level: 20 }],
      availability: availability.map((entry) => entry.slug === "instruments_basic_drums"
        ? { ...entry, status: "prerequisites_missing" as const } : entry),
    });
    expect(ranked.map((entry) => entry.slug)).not.toContain("instruments_basic_guitar");
    expect(ranked.map((entry) => entry.slug)).not.toContain("instruments_basic_drums");
  });

  it("distinguishes accumulated level XP from completed learning", () => {
    const ranked = recommend({
      progress: [{ skill_slug: "instruments_basic_guitar", current_level: 7, current_xp: 75, required_xp: 100 }],
    });
    expect(ranked.find((entry) => entry.slug === "instruments_basic_guitar")).toMatchObject({
      currentLevel: 7, nextLevel: 8, progressPercent: 75, isNew: false,
    });
  });

  it("does not suggest nonexistent learning when availability has not loaded", () => {
    expect(recommend({ availability: [] })).toEqual([]);
  });

  it("conceals inactive and hidden skill definitions even with unlocked tier", () => {
    const list = [...catalogue, { ...skill("instruments_basic_flute"), is_hidden: true },
      { ...skill("instruments_basic_harp"), is_active: false }];
    const access = new Map(list.map((entry) => [entry.slug, true]));
    const ranked = recommend({ catalogue: list, access });
    expect(ranked.map((entry) => entry.slug)).not.toContain("instruments_basic_flute");
    expect(ranked.map((entry) => entry.slug)).not.toContain("instruments_basic_harp");
  });
});
