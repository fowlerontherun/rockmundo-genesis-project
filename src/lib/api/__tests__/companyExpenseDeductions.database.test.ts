import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

import { deductCompanyExpense } from "@/lib/api/companyExpenseDeductions";

describe("company expense deduction database boundary", () => {
  beforeEach(() => rpc.mockReset());

  it("uses one authoritative RPC with an idempotency key", async () => {
    rpc.mockResolvedValue({
      data: {
        companyId: "company-1",
        amount: 2500,
        balance: 17500,
        financialTransactionId: "tx-1",
        idempotent: false,
      },
      error: null,
    });

    const result = await deductCompanyExpense({
      companyId: "company-1",
      amount: 2500,
      description: "Equipment upgrade",
      category: "equipment",
      idempotencyKey: "expense-request-1",
    });

    expect(rpc).toHaveBeenCalledWith("deduct_company_balance", {
      p_company_id: "company-1",
      p_amount: 2500,
      p_description: "Equipment upgrade",
      p_category: "equipment",
      p_idempotency_key: "expense-request-1",
    });
    expect(result.balance).toBe(17500);
  });

  it("does not provide a browser-side fallback", async () => {
    const error = new Error("insufficient_company_funds");
    rpc.mockResolvedValue({ data: null, error });
    await expect(deductCompanyExpense({
      companyId: "company-1",
      amount: 99999,
      description: "Upgrade",
      category: "equipment",
      idempotencyKey: "expense-request-2",
    })).rejects.toBe(error);
  });
});
