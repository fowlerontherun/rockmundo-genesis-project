import { describe, expect, it } from "vitest";
import { minorToMajor, releaseCostMajor, releaseProfitMajor } from "./releaseMoney";

describe("recorded release money units", () => {
  it("charges $42 rather than $4,200 for 2,700 + 1,500 cents", () => {
    expect(releaseCostMajor(2_700, 1_500)).toBe(42);
  });

  it("reports P/L in major units", () => {
    const grossMinor = 100 * 1_499;
    const taxMinor = Math.round(grossMinor * 0.10);
    const distributorMinor = Math.round(grossMinor * 0.20);
    const netMajor = minorToMajor(grossMinor - taxMinor - distributorMinor);
    expect(netMajor).toBeCloseTo(1_049.3, 2);
    expect(releaseProfitMajor(netMajor, 4_200)).toBeCloseTo(1_007.3, 2);
  });
});
