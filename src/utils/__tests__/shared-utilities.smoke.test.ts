import { describe, expect, it, vi } from "vitest";
import { cn } from "@/lib/utils";
import { clamp, clampPercent, clampScore } from "@/utils/number";
import { calculateSongQuality, canStartSongwriting, canWriteGenre, getSkillCeiling } from "@/utils/songQuality";

describe("shared utilities smoke tests", () => {
  it("merges Tailwind classes predictably", () => {
    expect(cn("px-2 text-sm", false && "hidden", "px-4")).toBe("text-sm px-4");
  });

  it("clamps common gameplay ranges", () => {
    expect(clamp(12, 0, 10)).toBe(10);
    expect(clampPercent(-3)).toBe(0);
    expect(clampScore(180)).toBe(100);
  });
});

describe("song creation quality regressions", () => {
  it("keeps songwriting availability permissive during beta", () => {
    expect(canStartSongwriting({})).toBe(true);
    expect(canWriteGenre("rock", {})).toBe(true);
  });

  it("raises the quality ceiling when professional or mastery skills are unlocked", () => {
    expect(getSkillCeiling({})).toBe(500);
    expect(getSkillCeiling({ songwriting_professional_composing: 10 })).toBe(800);
    expect(getSkillCeiling({ songwriting_mastery_lyrics: 10 })).toBe(1000);
  });

  it("calculates a bounded song score with deterministic session luck", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const result = calculateSongQuality({
      genre: "rock",
      skillLevels: {
        songwriting_basic_composing: 40,
        songwriting_basic_lyrics: 40,
        songwriting_basic_arrangement: 40,
        songwriting_basic_record_production: 40,
        songwriting_basic_rhythm: 40,
        genre_rock_basic: 50,
      },
      attributes: { creative_insight: 600, musical_ability: 600, technical_mastery: 600 },
      sessionHours: 4,
      coWriters: 1,
      aiLyrics: false,
      songsWritten: 5,
      sessionsCompleted: 2,
      instrumentSkills: [{ slug: "guitar", level: 25 }],
    });

    expect(result.totalQuality).toBeGreaterThan(0);
    expect(result.totalQuality).toBeLessThanOrEqual(result.skillCeiling);
    expect(result.sessionLuckLabel).toContain("Normal Session");
    expect(result.instrumentationBonus).toBeGreaterThan(0);
  });
});
