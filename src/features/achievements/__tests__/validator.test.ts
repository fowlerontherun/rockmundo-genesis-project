import { describe, expect, it } from "vitest";
import { CANONICAL_ACHIEVEMENTS, CANONICAL_CRITERIA } from "../catalogue";
import { validateAchievementCatalogue } from "../validator";

describe("achievement catalogue validator", () => {
  it("accepts the canonical progression catalogue", () => {
    expect(validateAchievementCatalogue().errors).toEqual([]);
  });

  it("detects duplicate slugs and missing criteria", () => {
    const result = validateAchievementCatalogue([
      CANONICAL_ACHIEVEMENTS[0],
      { ...CANONICAL_ACHIEVEMENTS[0], name: "Duplicate" },
      { ...CANONICAL_ACHIEVEMENTS[1], slug: "no-criteria" },
    ], CANONICAL_CRITERIA.slice(0, 1));

    expect(result.errors).toContain("Duplicate achievement slug first-skill-unlocked");
    expect(result.errors).toContain("Active achievement no-criteria has no criteria");
  });

  it("requires repeatable achievements to have safe limits", () => {
    const result = validateAchievementCatalogue([
      { ...CANONICAL_ACHIEVEMENTS[0], is_repeatable: true, repeat_limit: null },
    ], [CANONICAL_CRITERIA[0]]);

    expect(result.errors).toContain("Repeatable achievement first-skill-unlocked needs a safe repeat limit");
  });
});
