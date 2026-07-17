import { describe, expect, it, vi, beforeEach } from "vitest";
import { financeService, toMinorUnits, FinanceError } from "../financeService";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
const rpc = vi.mocked((supabase as any).rpc);

describe("financeService", () => {
  beforeEach(() => rpc.mockReset());
  it("converts dollars to integer minor units", () => { expect(toMinorUnits(12.34)).toBe(1234); });
  it("rejects non-positive amounts", () => { expect(() => toMinorUnits(0)).toThrow(FinanceError); });
  it("credits through the finance_credit_owner RPC", async () => {
    rpc.mockResolvedValue({ data: "tx-1", error: null });
    await expect(financeService.credit("player", "p1", 50, "starting_funds", "Start", "idem", "p1")).resolves.toBe("tx-1");
    expect(rpc).toHaveBeenCalledWith("finance_credit_owner", expect.objectContaining({ p_owner_type: "player", p_amount_minor: 5000, p_category: "starting_funds" }));
  });
  it("prevents self transfers before calling the server", async () => {
    await expect(financeService.transfer({ source: { ownerType: "player", ownerId: "p1" }, destination: { ownerType: "player", ownerId: "p1" }, amount: 10, category: "player_to_player_transfer", description: "No", idempotencyKey: "same" })).rejects.toMatchObject({ code: "self_transfer" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("wraps RPC failures as typed finance errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "insufficient funds", code: "P0001" } });
    await expect(financeService.debit("player", "p1", 999, "equipment_purchase", "Guitar", "idem", "p1")).rejects.toMatchObject({ code: "P0001" });
  });
});
