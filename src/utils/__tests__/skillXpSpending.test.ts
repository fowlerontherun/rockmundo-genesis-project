import { describe, expect, it } from "vitest";
import { getXpToSkillMax, previewSkillXpSpend } from "../skillXpSpending";

describe("skill XP spending preview", () => {
  it("supports partial XP without leveling", () => {
    const p = previewSkillXpSpend({ currentLevel: 2, xpIntoLevel: 40, xpRequiredForNextLevel: 100, maxLevel: 5 }, 35, 35);
    expect(p.afterLevel).toBe(2); expect(p.afterXpIntoLevel).toBe(75); expect(p.walletAfterSpend).toBe(0);
  });
  it("crosses multiple levels and preserves overflow", () => {
    const p = previewSkillXpSpend({ currentLevel: 2, xpIntoLevel: 80, xpRequiredForNextLevel: 100, maxLevel: 5 }, 450, 450);
    expect(p.afterLevel).toBeGreaterThan(3); expect(p.levelsGained).toBe(p.afterLevel - 2); expect(p.usefulSpend).toBeLessThanOrEqual(450);
  });
  it("max clamps to wallet when wallet is below cap", () => {
    const p = previewSkillXpSpend({ currentLevel: 1, xpIntoLevel: 0, xpRequiredForNextLevel: 100, maxLevel: 3 }, 50, 999);
    expect(p.maximumSpend).toBe(50); expect(p.usefulSpend).toBe(50);
  });
  it("max clamps to XP remaining to cap", () => {
    const state = { currentLevel: 2, xpIntoLevel: 99, xpRequiredForNextLevel: 100, maxLevel: 3 };
    expect(getXpToSkillMax(state)).toBe(1);
    const p = previewSkillXpSpend(state, 1000, 1000);
    expect(p.usefulSpend).toBe(1); expect(p.afterLevel).toBe(3); expect(p.walletAfterSpend).toBe(999);
  });
  it("selects zero for a maxed skill", () => {
    const p = previewSkillXpSpend({ currentLevel: 3, xpIntoLevel: 0, xpRequiredForNextLevel: null, maxLevel: 3 }, 100, 100);
    expect(p.maximumSpend).toBe(0); expect(p.usefulSpend).toBe(0); expect(p.isMaxLevel).toBe(true);
  });
});
