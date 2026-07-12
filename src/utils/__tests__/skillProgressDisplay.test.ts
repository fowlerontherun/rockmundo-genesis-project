import { describe, expect, it } from "vitest";
import { calculateSkillOverviewStats, clampProgressPercent, getSkillDisplayProgress, SKILL_PRACTICE_CONFIG } from "../skillProgressDisplay";

describe("skill progress display helpers", () => {
  it("excludes locked skills from counts and averages", () => {
    const stats = calculateSkillOverviewStats([
      { current_level: 0, current_xp: 10, is_unlocked: false, can_practice: false, lifetime_xp: 10 },
      { current_level: 2, current_xp: 20, is_unlocked: true, can_practice: true, lifetime_xp: 220 },
    ] as any);
    expect(stats.unlockedCount).toBe(1);
    expect(stats.averageLevel).toBe(2);
    expect(stats.practiceableCount).toBe(1);
    expect(stats.lifetimeXp).toBe(230);
  });

  it("returns safe zero with no unlocked skills", () => {
    const stats = calculateSkillOverviewStats([{ current_level: 0, current_xp: 0 }] as any);
    expect(stats.unlockedCount).toBe(0);
    expect(stats.averageLevel).toBe(0);
  });

  it("clamps malformed progress displays", () => {
    expect(clampProgressPercent(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampProgressPercent(-10)).toBe(0);
    expect(clampProgressPercent(120)).toBe(100);
    expect(getSkillDisplayProgress({ current_level: 1, current_xp: 200, xp_required_for_next_level: 100 } as any).progress_percent).toBe(100);
    expect(getSkillDisplayProgress({ current_level: 1, current_xp: -20, xp_required_for_next_level: 0 } as any).progress_percent).toBe(0);
  });

  it("uses shared practice config defaults", () => {
    const display = getSkillDisplayProgress({ current_level: SKILL_PRACTICE_CONFIG.minimumSkillLevel } as any);
    expect(display.can_practice).toBe(true);
    expect(SKILL_PRACTICE_CONFIG.maxDailySessions).toBeGreaterThan(0);
  });
});
