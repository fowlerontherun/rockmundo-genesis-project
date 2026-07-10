import { describe, expect, it } from "vitest";
import { calculateCompanyJobSuitability } from "./companyRecruitmentLifecycle";

describe("company recruitment lifecycle suitability", () => {
  it("rates strong candidates as good or excellent matches", () => {
    const result = calculateCompanyJobSuitability({
      requiredSkills: { marketing: 3, sales: 2 },
      preferredSkills: { leadership: 2 },
      playerSkills: { marketing: 4, sales: 2, leadership: 3 },
      sameLocation: true,
      fame: 300,
    });
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(["Good match", "Excellent match"]).toContain(result.rating);
    expect(result.missingRequirements).toHaveLength(0);
  });

  it("preserves explainable missing requirements without hard-blocking suitability", () => {
    const result = calculateCompanyJobSuitability({
      requiredSkills: { security: 5 },
      playerSkills: { security: 1 },
      sameLocation: false,
      hasFullTimeConflict: true,
    });
    expect(result.score).toBeLessThan(45);
    expect(result.rating).toBe("Poor match");
    expect(result.missingRequirements).toContain("security 5+");
    expect(result.missingRequirements).toContain("No conflicting full-time employment");
  });
});
