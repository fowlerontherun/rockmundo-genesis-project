import { describe, expect, it } from "vitest";
import { calculateSaleDeductions, distributionRate } from "./release-finance";

describe("release sale deductions", () => {
  it("uses overrides, fallbacks, and clamps invalid fee extremes", () => {
    expect(distributionRate(12, 30)).toBe(0.12);
    expect(distributionRate(null, 30)).toBe(0.30);
    expect(distributionRate(-10, 20)).toBe(0);
    expect(distributionRate(500, 20)).toBe(0.50);
  });

  it("takes manufacturer share only on physical sales and splits the remainder", () => {
    const physical = calculateSaleDeductions({ quantity: 1, unitPriceMinor: 1_000, taxRate: .1, distributionRate: .2, physical: true, manufacturerRevenueSharePercentage: 10, labelShareRate: .25 });
    expect(physical.manufacturerShareMinor).toBe(100);
    expect(physical.preLabelNetMinor).toBe(600);
    expect(physical.labelShareMinor).toBe(150);
    expect(physical.bandNetMinor).toBe(450);
    expect(calculateSaleDeductions({ quantity: 1, unitPriceMinor: 1_000, taxRate: .1, distributionRate: .3, physical: false, manufacturerRevenueSharePercentage: 10 }).manufacturerShareMinor).toBe(0);
  });
});
