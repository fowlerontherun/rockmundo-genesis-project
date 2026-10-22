import { describe, expect, it } from "vitest";
import { marketUpgradeCost, marketUpgradeCooldownUntil } from "./marketUpgradeModel";

describe("city cooking market upgrades (display-only helpers)", () => {
  it("quotes the four server-owned upgrade tier costs", () => {
    expect([1, 2, 3, 4, 5].map(marketUpgradeCost)).toEqual([20000, 40000, 80000, 160000, null]);
  });
  it("never quotes a price for invalid tiers", () => {
    expect(marketUpgradeCost(0)).toBeNull();
    expect(marketUpgradeCost(6)).toBeNull();
    expect(marketUpgradeCost(2.5)).toBeNull();
  });
  it("calculates a full seven-day cooldown and tolerates missing data", () => {
    expect(marketUpgradeCooldownUntil("2026-10-22T04:00:00.000Z"))
      .toBe(Date.parse("2026-10-29T04:00:00.000Z"));
    expect(marketUpgradeCooldownUntil(null)).toBeNull();
    expect(marketUpgradeCooldownUntil("not a timestamp")).toBeNull();
  });
});
