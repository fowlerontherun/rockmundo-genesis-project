import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc },
}));

import { distributeCompanyAnnualProfit } from "@/lib/api/companyProfitDistributions";

describe("company annual profit distribution database boundary", () => {
  beforeEach(() => rpc.mockReset());

  it("uses the authoritative annual distribution RPC", async () => {
    rpc.mockResolvedValue({
      data: [{ distributed_profit: 12_500, game_year: 3 }],
      error: null,
    });

    const result = await distributeCompanyAnnualProfit("company-1");

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("distribute_company_annual_profit", {
      p_company_id: "company-1",
    });
    expect(result).toEqual({ distributedProfit: 12_500, gameYear: 3 });
  });

  it("supports scalar PostgREST responses", async () => {
    rpc.mockResolvedValue({
      data: { distributed_profit: "2500", game_year: "4" },
      error: null,
    });

    await expect(distributeCompanyAnnualProfit("company-2")).resolves.toEqual({
      distributedProfit: 2500,
      gameYear: 4,
    });
  });

  it("propagates database failures without browser-side payout fallbacks", async () => {
    const error = new Error("shareholder_active_profile_required");
    rpc.mockResolvedValue({ data: null, error });

    await expect(distributeCompanyAnnualProfit("company-1")).rejects.toBe(error);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
