import { describe, expect, it } from "vitest";
import {
  CANONICAL_ATTRIBUTE_LINKS,
  CANONICAL_ROLE_LINKS,
  CANONICAL_SKILLS,
  CANONICAL_SYSTEM_LINKS,
  CANONICAL_UNLOCK_ROUTES,
  KNOWN_ATTRIBUTE_KEYS,
} from "../skillCatalogue";
import { validateSkillCatalogue } from "../skillCatalogueValidation";
import { FULL_ATTRIBUTE_METADATA } from "../attributeProgression";
import {
  PROGRESSION_BALANCE,
  getAttributeUpgradeCost,
  getCumulativeXpForSkillLevel,
  getLevelFromLifetimeXp,
  getProgressWithinLevel,
  getXpRequiredForLevel,
  getXpRequiredForNextLevel,
} from "../progressionBalance";

const activeSkills = CANONICAL_SKILLS.filter((skill) => skill.is_active);

describe("final Skills & Attributes programme invariants", () => {
  it("keeps every active skill complete and explicitly mapped", () => {
    const result = validateSkillCatalogue();
    expect(result.errors).toEqual([]);

    const slugs = new Set<string>();
    for (const skill of activeSkills) {
      expect(slugs.has(skill.slug)).toBe(false);
      slugs.add(skill.slug);
      expect(skill.name).toBeTruthy();
      expect(skill.description).toBeTruthy();
      expect(skill.category).toBeTruthy();
      expect(skill.max_level).toBeGreaterThan(0);
      expect(skill.progression_curve_key).toBeTruthy();
      expect(CANONICAL_ATTRIBUTE_LINKS.some((link) => link.skill_slug === skill.slug)).toBe(true);
      expect(CANONICAL_SYSTEM_LINKS.some((link) => link.skill_slug === skill.slug)).toBe(true);
      expect(CANONICAL_UNLOCK_ROUTES.some((route) => route.skill_slug === skill.slug)).toBe(true);
    }
  });

  it("keeps every active attribute documented and connected to learning effects", () => {
    for (const key of KNOWN_ATTRIBUTE_KEYS) {
      expect(FULL_ATTRIBUTE_METADATA[key]?.label).toBeTruthy();
      expect(FULL_ATTRIBUTE_METADATA[key]?.description).toBeTruthy();
      expect(FULL_ATTRIBUTE_METADATA[key]?.affectedSystems?.length).toBeGreaterThan(0);
    }
    const linkedAttributeKeys = new Set(CANONICAL_ATTRIBUTE_LINKS.map((link) => link.attribute_key));
    for (const link of CANONICAL_ATTRIBUTE_LINKS) {
      expect(KNOWN_ATTRIBUTE_KEYS).toContain(link.attribute_key);
      expect(link.weight).toBeGreaterThan(0);
      expect(link.max_bonus).toBeGreaterThan(0);
    }
    expect(linkedAttributeKeys.size).toBeGreaterThan(0);
  });

  it("uses authoritative progression helpers for bounded XP and AP rules", () => {
    const skill = activeSkills[0];
    expect(getXpRequiredForLevel(skill, 1)).toBeGreaterThan(0);
    expect(getXpRequiredForNextLevel(skill, 0)).toBe(getXpRequiredForLevel(skill, 1));
    const levelFiveXp = getCumulativeXpForSkillLevel(skill, 5);
    expect(getLevelFromLifetimeXp(skill, levelFiveXp)).toBe(5);
    expect(getProgressWithinLevel(skill, levelFiveXp).progressPercent).toBe(0);
    expect(getAttributeUpgradeCost(0)).toBeGreaterThan(0);
    expect(PROGRESSION_BALANCE.learning.totalAttributeBonusCap).toBeLessThanOrEqual(0.25);
    expect(PROGRESSION_BALANCE.practice.dailySessionLimit).toBeGreaterThan(0);
  });

  it("keeps cross-system role mappings resolvable", () => {
    const activeSlugs = new Set(activeSkills.map((skill) => skill.slug));
    for (const link of [...CANONICAL_SYSTEM_LINKS, ...CANONICAL_ROLE_LINKS]) {
      expect(activeSlugs.has(link.skill_slug)).toBe(true);
      expect(link.weight).toBeGreaterThan(0);
    }
  });
});
