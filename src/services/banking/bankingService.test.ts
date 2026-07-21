import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcCalls, mockSupabase } = vi.hoisted(() => {
  const rpcCalls: Array<{ name: string; args: unknown[] }> = [];
  const mockSupabase = {
    rest: {},
    rpc(this: { rest?: unknown }, name: string, ...args: unknown[]) {
      if (!this.rest) throw new Error("rpc lost Supabase client binding");
      rpcCalls.push({ name, args });
      return Promise.resolve({ data: { accounts: [], loans: [], recentActivity: [] }, error: null });
    },
  };

  return { rpcCalls, mockSupabase };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: mockSupabase }));

import { fetchBankingDashboard, formatCurrencyMinor, mapBankingError, summarizeEqualPrincipalOffer } from "./bankingService";

describe("bankingService", () => {
  beforeEach(() => {
    rpcCalls.length = 0;
  });

  it("formats configured currency minor units", () => {
    expect(formatCurrencyMinor({ amountMinor: 123456, currencyCode: "USD", locale: "en-US" })).toContain("$1,234.56");
    expect(formatCurrencyMinor({ amountMinor: 123456, currencyCode: "GBP", locale: "en-GB" })).toContain("£1,234.56");
    expect(formatCurrencyMinor({ amountMinor: 123456, currencyCode: "EUR", locale: "de-DE" })).toContain("1.234,56");
    expect(formatCurrencyMinor({ amountMinor: 123456, currencyCode: "JPY", locale: "ja-JP" })).toContain("￥123,456");
  });

  it("calls the dashboard RPC as a bound zero-argument Supabase client method", async () => {
    await expect(fetchBankingDashboard()).resolves.toMatchObject({ accounts: [], loans: [], recentActivity: [] });

    expect(rpcCalls).toEqual([{ name: "get_banking_dashboard", args: [] }]);
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

  it("maps permission, funding, missing RPC, and unexpected client errors safely", () => {
    expect(mapBankingError({ code: "42501" })).toContain("permission");
    expect(mapBankingError({ message: "insufficient funds" })).toContain("not enough money");
    expect(mapBankingError({ code: "PGRST202", message: "Could not find the function public.get_banking_dashboard without parameters in the schema cache" })).toBe("Banking is temporarily unavailable while the finance service is being updated. Please try again shortly.");
    expect(mapBankingError({ message: "Cannot read properties of undefined (reading 'rest')" })).toBe("Banking could not be loaded. Please try again.");
  });
});
