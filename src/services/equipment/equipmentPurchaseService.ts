import { supabase } from "@/integrations/supabase/client";

export interface AtomicEquipmentPurchaseResult {
  status: "completed" | "already_completed";
  purchaseId?: string;
  inventoryId?: string;
  equipmentId?: string;
  amount?: number;
  remainingCash?: number;
}

const translatePurchaseError = (error: any): Error => {
  const message = error?.message ?? "Equipment purchase failed";

  if (message.includes("insufficient_funds")) return new Error("Insufficient funds");
  if (message.includes("equipment_out_of_stock")) return new Error("Item is out of stock");
  if (message.includes("equipment_not_available")) return new Error("Equipment is no longer available");
  if (message.includes("profile_not_owned_by_user")) return new Error("The active character could not be verified");

  return error instanceof Error ? error : new Error(message);
};

/**
 * Authoritative equipment-store purchase path.
 *
 * Do not route equipment purchases through financeService.debit or
 * finance_debit_owner. The live database uses purchase_equipment_atomic so
 * cash deduction, stock decrement and inventory creation happen in one
 * PostgreSQL transaction.
 */
export async function purchaseEquipmentAtomic(
  profileId: string,
  equipmentId: string,
  idempotencyKey = crypto.randomUUID(),
): Promise<AtomicEquipmentPurchaseResult> {
  const { data, error } = await (supabase as any).rpc("purchase_equipment_atomic", {
    p_profile_id: profileId,
    p_equipment_id: equipmentId,
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw translatePurchaseError(error);

  return data as AtomicEquipmentPurchaseResult;
}
