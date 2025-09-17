import { describe, expect, it } from "bun:test";
import { checkTourRequirements } from "../tourRequirementValidation";

const requirements = { fame: 1000, performance: 50 };

describe("checkTourRequirements", () => {
  it("identifies locked performance skill and adds descriptive message", () => {
    const result = checkTourRequirements(requirements, {
      fame: 1200,
      skills: { performance: 60 },
      unlockedSkills: {},
      skillProgress: [],
    });

    expect(result.meets).toBe(false);
    expect(result.missing).toContain("Performance skill is locked");
  });

  it("passes when performance skill is unlocked and requirements are met", () => {
    const result = checkTourRequirements(requirements, {
      fame: 1500,
      skills: { performance: 65 },
      unlockedSkills: { performance: true },
      skillProgress: [],
    });

    expect(result.meets).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("treats skill progress rows as unlocked when slug matches", () => {
    const result = checkTourRequirements(requirements, {
      fame: 1400,
      skills: { performance: 70 },
      unlockedSkills: {},
      skillProgress: [
        {
          id: "progress-1",
          profile_id: "profile-1",
          skill_id: "skill-1",
          skill_slug: "performance",
          current_level: 70,
          current_experience: 0,
          created_at: null,
          updated_at: null,
        },
      ],
    });

    expect(result.meets).toBe(true);
    expect(result.missing).toHaveLength(0);
  });
});
