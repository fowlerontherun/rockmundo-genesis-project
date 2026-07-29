import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc },
}));

import { transferCompanyFunds } from "@/lib/api/companyFundTransfers";

describe("company fund transfer database boundary", () => {
  beforeEach(() => rpc.mockReset());

  it.each([
    ["deposit", undefined],
    ["withdrawal", undefined],
    ["intercompany", "company-2"],
  ] as const)("uses one authoritative RPC for %s", async (transferKind, destinationCompanyId) => {
    rpc.mockResolvedValue({
      data: {
        transferKind,
        sourceCompanyId: "company-1",
        destinationCompanyId: destinationCompanyId ?? null,
        amount: 25000,
        personalCash: 75000,
        sourceBalance: 125000,
        destinationBalance: destinationCompanyId ? 225000 : null,
        financialTransactionId: "finance-1",
        idempotent: false,
      },
      error: null,
    });

    const result = await transferCompanyFunds({
      transferKind,
      companyId: "company-1",
      amount: 25000,
      destinationCompanyId,
      idempotencyKey: `request-${transferKind}`,
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("transfer_company_funds", {
      p_transfer_kind: transferKind,
      p_company_id: "company-1",
      p_amount: 25000,
      p_destination_company_id: destinationCompanyId ?? null,
      p_idempotency_key: `request-${transferKind}`,
    });
    expect(result.transferKind).toBe(transferKind);
  });

  it("propagates failures without browser-side fallback writes", async () => {
    const error = new Error("minimum_company_balance_required");
    rpc.mockResolvedValue({ data: null, error });

    await expect(transferCompanyFunds({
      transferKind: "withdrawal",
      companyId: "company-1",
      amount: 25000,
      idempotencyKey: "request-failed",
    })).rejects.toBe(error);

    expect(rpc).toHaveBeenCalledTimes(1);
  });
});