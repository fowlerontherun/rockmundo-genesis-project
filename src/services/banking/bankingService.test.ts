import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

import { fetchBankingDashboard, formatCurrencyMinor, mapBankingError, summarizeEqualPrincipalOffer } from "./bankingService";

describe("bankingService", () => {
  beforeEach(() => rpc.mockReset());

  it("formats configured currency minor units", () => {
    expect(formatCurrencyMinor({ amountMinor: 123456, currencyCode: "USD", locale: "en-US" })).toContain("$1,234.56");
    expect(formatCurrencyMinor({ amountMinor: 123456, currencyCode: "GBP", locale: "en-GB" })).toContain("£1,234.56");
    expect(formatCurrencyMinor({ amountMinor: 123456, currencyCode: "EUR", locale: "de-DE" })).toContain("1.234,56");
    expect(formatCurrencyMinor({ amountMinor: 123456, currencyCode: "JPY", locale: "ja-JP" })).toContain("￥123,456");
  });

  it("calls the dashboard RPC with the zero-argument signature", async () => {
    rpc.mockResolvedValue({ data: { accounts: [], loans: [], recentActivity: [] }, error: null });

    await expect(fetchBankingDashboard()).resolves.toMatchObject({ accounts: [], loans: [], recentActivity: [] });

    expect(rpc).toHaveBeenCalledWith("get_banking_dashboard");
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

  it("maps permission, funding, and missing RPC errors", () => {
    expect(mapBankingError({ code: "42501" })).toContain("permission");
    expect(mapBankingError({ message: "insufficient funds" })).toContain("not enough money");
    expect(mapBankingError({ code: "PGRST202", message: "Could not find the function public.get_banking_dashboard without parameters in the schema cache" })).toBe("Banking is temporarily unavailable while the finance service is being updated. Please try again shortly.");
  });
});
