import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { purchaseEquipmentAtomic } from "../equipmentPurchaseService";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn() },
}));

const rpc = vi.mocked((supabase as any).rpc);
const idempotencyKey = "123e4567-e89b-12d3-a456-426614174000";

describe("purchaseEquipmentAtomic", () => {
  beforeEach(() => rpc.mockReset());

  it("uses purchase_equipment_atomic and never the legacy finance debit RPC", async () => {
    rpc.mockResolvedValue({
      data: { status: "completed", inventoryId: "inventory-1" },
      error: null,
    });

    await purchaseEquipmentAtomic("profile-1", "equipment-1", idempotencyKey);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("purchase_equipment_atomic", {
      p_profile_id: "profile-1",
      p_equipment_id: "equipment-1",
      p_idempotency_key: idempotencyKey,
    });
    expect(rpc).not.toHaveBeenCalledWith("finance_debit_owner", expect.anything());
  });

  it("translates insufficient funds into a player-friendly error", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "insufficient_funds" },
    });

    await expect(
      purchaseEquipmentAtomic("profile-1", "equipment-1", idempotencyKey),
    ).rejects.toThrow("Insufficient funds");
  });
});