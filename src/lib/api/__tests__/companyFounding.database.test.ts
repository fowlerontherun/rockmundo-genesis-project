import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc },
}));

import { foundCompany } from "@/lib/api/companyFounding";

describe("foundCompany", () => {
  beforeEach(() => rpc.mockReset());

  it("uses one authoritative RPC for the complete founding operation", async () => {
    rpc.mockResolvedValue({
      data: {
        companyId: "company-1",
        personalCash: 500000,
        foundingCost: 500000,
        startingBalance: 1000000,
        weeklyOperatingCosts: 2500,
        idempotent: false,
      },
      error: null,
    });

    await expect(foundCompany({
      name: "RockMundo Holdings",
      company_type: "holding",
      description: "A music business group",
      headquarters_city_id: "city-1",
    }, "request-12345678")).resolves.toMatchObject({ companyId: "company-1" });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("found_company", {
      p_name: "RockMundo Holdings",
      p_company_type: "holding",
      p_description: "A music business group",
      p_headquarters_city_id: "city-1",
      p_parent_company_id: null,
      p_idempotency_key: "request-12345678",
    });
  });

  it("does not add a browser-side fallback when the RPC fails", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("insufficient_personal_funds") });

    await expect(foundCompany({
      name: "Studio One",
      company_type: "recording_studio",
    }, "request-abcdefgh")).rejects.toThrow("insufficient_personal_funds");

    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
