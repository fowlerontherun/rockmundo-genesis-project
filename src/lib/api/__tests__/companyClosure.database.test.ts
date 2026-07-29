import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc },
}));

import { closeCompany } from "@/lib/api/companyClosure";

describe("company closure database boundary", () => {
  beforeEach(() => rpc.mockReset());

  it("uses one authoritative RPC with an idempotency key", async () => {
    rpc.mockResolvedValue({
      data: {
        companyId: "company-1",
        companyName: "Example Ltd",
        transferredAmount: 125000,
        personalCash: 250000,
        status: "dissolved",
        idempotent: false,
      },
      error: null,
    });

    const result = await closeCompany("company-1", true, "closure-request-1");

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("close_company", {
      p_company_id: "company-1",
      p_transfer_balance: true,
      p_idempotency_key: "closure-request-1",
    });
    expect(result.status).toBe("dissolved");
  });

  it("propagates database failures without a client-side fallback", async () => {
    const error = new Error("active_artist_contracts_exist");
    rpc.mockResolvedValue({ data: null, error });

    await expect(closeCompany("company-1", true, "closure-request-2")).rejects.toBe(error);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
