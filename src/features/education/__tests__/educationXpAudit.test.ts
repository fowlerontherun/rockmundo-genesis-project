import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { calculateLearningMultiplier } from "../../../../supabase/functions/_shared/book-reading-learning";
import { skillXpProgressPercent } from "../utils/skillXpProgress";

describe("book-reading learning bonus boundaries (#2678)", () => {
  it("does not penalize negative or invalid attributes", () => {
    expect(calculateLearningMultiplier("guitar", { musical_ability: -100 })).toBe(1);
    expect(calculateLearningMultiplier("guitar", { musical_ability: Number.NaN })).toBe(1);
    expect(calculateLearningMultiplier("genres_rock", { musical_ability: -5, creative_insight: -3 })).toBe(1);
  });
  it("caps high values while preserving normal bonuses", () => {
    expect(calculateLearningMultiplier("guitar", { musical_ability: 500 })).toBe(1.25);
    expect(calculateLearningMultiplier("guitar", { musical_ability: 10000 })).toBe(1.5);
    expect(calculateLearningMultiplier("guitar", null)).toBe(1);
  });
});

describe("education summary skill XP progress (#3162)", () => {
  it("shows complete progress for a maxed skill without dividing by zero", () => {
    expect(skillXpProgressPercent(0, 0)).toBe(100);
  });
  it("clamps unexpected progress to a finite percentage", () => {
    expect(skillXpProgressPercent(150, 100)).toBe(100);
    expect(skillXpProgressPercent(-10, 100)).toBe(0);
    expect(skillXpProgressPercent(20, 100)).toBe(20);
    expect(skillXpProgressPercent(Number.NaN, 100)).toBe(0);
  });
});

describe("education cache invalidation contracts (#3159, #3163)", () => {
  it("refreshes both active skill cache spellings and summary after video rewards", () => {
    const source = readFileSync("src/features/education/hooks/useWatchVideo.ts", "utf8");
    expect(source).toContain('queryKey: ["skill-progress"]');
    expect(source).toContain('queryKey: ["skill_progress"]');
    expect(source).toContain('queryKey: ["education-summary-skills"]');
  });
  it("refreshes summary skill cache after university attendance", () => {
    const source = readFileSync("src/hooks/useUniversityAttendance.ts", "utf8");
    expect(source).toContain('queryKey: ["education-summary-skills"]');
  });
});

describe("attendance retry control flow (#2666)", () => {
  it("terminates the session after success and terminal outcomes", () => {
    const source = readFileSync("supabase/functions/book-reading-attendance/index.ts", "utf8");
    expect(source).toMatch(/reason: "already_recorded"[^]*?break;/);
    expect(source).toMatch(/tierUnlocked === false[^]*?errorCount \+= 1;\s*break;/);
    expect(source).toMatch(/if \(applied\?\.reason\)[^]*?break;/);
    expect(source).toMatch(/processedCount \+= 1;[^]*?break;/);
    expect(source).toMatch(/if \(attempt === 0\) continue;/);
  });
  it("does not accept a malformed service-role bearer token", () => {
    const source = readFileSync("supabase/functions/book-reading-attendance/index.ts", "utf8");
    expect(source).toContain('authorization?.replace(/^Bearer[ \\t]+/i, "")');
  });
});
