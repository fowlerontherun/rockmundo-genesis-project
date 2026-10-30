import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const browser=readFileSync("src/hooks/useFestivalPerformance.ts","utf8");

describe("festival award / performance payment is server-authoritative",()=>{
  it("uses the settlement receipt and does not credit the browser balance twice",()=>{
    expect(browser).toContain('"settle_legacy_festival_participation"');
    expect(browser).toContain("settlement?.payment_earned");
    expect(browser).toContain("settlement?.merch_revenue");
    expect(browser).toContain("Do NOT credit band_balance");
    expect(browser).not.toContain('band_balance: (bandUpdate.band_balance || 0) + result.paymentEarned + result.merchRevenue');
  });
});
