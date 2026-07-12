import { describe, expect, it, vi } from "vitest";
import {
  calculateWeightedLearningMultiplier,
  getAvailabilityForSkill,
  getSkillAttributeLinks,
} from "../skillCatalogue";
import {
  detectPrerequisiteCycles,
  validateSkillCatalogue,
} from "../skillCatalogueValidation";
import {
  getSkillLearningMultiplier,
  skillLearningDiagnostics,
} from "../skillLearningMultiplier";

describe("canonical skill catalogue", () => {
  it("passes catalogue integrity validation", () => {
    expect(validateSkillCatalogue().errors).toEqual([]);
  });
  it("uses explicit weighted learning attributes", () => {
    expect(getSkillAttributeLinks("guitar")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attribute_key: "musical_ability",
          weight: 0.7,
        }),
      ]),
    );
    expect(
      calculateWeightedLearningMultiplier("guitar", {
        musical_ability: 1000,
        musicality: 0,
      }).boostPercent,
    ).toBe(35);
  });
  it("warns and records diagnostics for legacy regex fallback only", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    skillLearningDiagnostics.fallbackSkillSlugs.clear();
    expect(
      getSkillLearningMultiplier("genres_basic_rock", {
        musical_ability: 1000,
        creative_insight: 1000,
      }).boostPercent,
    ).toBe(50);
    expect(
      skillLearningDiagnostics.fallbackSkillSlugs.has("genres_basic_rock"),
    ).toBe(true);
    warn.mockRestore();
  });
  it("does not assign arbitrary bonuses to unmapped skills", () => {
    expect(
      getSkillLearningMultiplier("unknown_legacy_slug", {
        musical_ability: 1000,
      }).boostPercent,
    ).toBe(0);
  });
});

describe("skill prerequisites and availability", () => {
  it("detects missing prerequisite levels", () =>
    expect(
      getAvailabilityForSkill({ songwriting: 5 }, "composition"),
    ).toMatchObject({
      status: "prerequisites_missing",
      blockedReason: { code: "PREREQUISITE_LEVEL_TOO_LOW" },
    }));
  it("permits valid prerequisite levels", () =>
    expect(
      getAvailabilityForSkill({ songwriting: 20 }, "composition").status,
    ).toBe("available_to_unlock"));
  it("returns unlocked and maxed states", () => {
    expect(getAvailabilityForSkill({ guitar: 1 }, "guitar").status).toBe(
      "unlocked",
    );
    expect(getAvailabilityForSkill({ guitar: 100 }, "guitar").status).toBe(
      "maxed",
    );
  });
  it("detects circular relationships", () =>
    expect(
      detectPrerequisiteCycles([
        {
          skill_slug: "a",
          prerequisite_skill_slug: "b",
          required_level: 1,
          prerequisite_type: "required",
        },
        {
          skill_slug: "b",
          prerequisite_skill_slug: "a",
          required_level: 1,
          prerequisite_type: "required",
        },
      ] as any).length,
    ).toBeGreaterThan(0));
});
