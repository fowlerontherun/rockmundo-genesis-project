import { describe, expect, it } from "vitest";
import { formatCurrencyMinor, mapBankingError, summarizeEqualPrincipalOffer } from "./bankingService";

describe("bankingService", () => {
  it("formats minor-unit currencies", () => {
    expect(formatCurrencyMinor({ amountMinor: 123456, currencyCode: "USD" })).toContain("1,234.56");
  });

  it("summarizes declining equal-principal schedules without fixed-payment wording", () => {
    const summary = summarizeEqualPrincipalOffer({
      principalMinor: 100000,
      originationFeeMinor: 1000,
      currencyCode: "USD",
      totalInterestMinor: 6000,
      scheduleLines: [{ totalDueMinor: 19000 }, { totalDueMinor: 18000 }, { totalDueMinor: 17000 }],
    });

    expect(summary.firstPaymentMinor).toBe(19000);
    expect(summary.finalPaymentMinor).toBe(17000);
    expect(summary.totalRepaymentMinor).toBe(107000);
    expect(summary.scheduleDescription).toContain("payments decline");
    expect(summary.scheduleDescription).not.toContain("fixed");
  });

  it("maps permission and funding errors", () => {
    expect(mapBankingError({ code: "42501" })).toContain("permission");
    expect(mapBankingError({ message: "insufficient funds" })).toContain("not enough money");
  });
});
