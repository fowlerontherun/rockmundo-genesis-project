import { supabase } from "@/integrations/supabase/client";

export type FinanceOwnerType = "player" | "band" | "company" | "venue" | "city" | "country" | "system";
export type FinanceTransactionCategory =
  | "starting_funds" | "administrative_adjustment" | "player_to_player_transfer" | "band_contribution" | "band_withdrawal"
  | "wage_payment" | "ticket_sale" | "gig_payment" | "festival_payment" | "recording_studio_payment" | "rehearsal_payment"
  | "travel_cost" | "accommodation_cost" | "equipment_purchase" | "equipment_sale" | "equipment_repair" | "merchandise_revenue"
  | "merchandise_production_cost" | "streaming_royalty" | "song_release_royalty" | "company_revenue" | "company_operating_expense"
  | "refund" | "tax_placeholder" | "system_fee";

export class FinanceError extends Error { constructor(message: string, public code: string) { super(message); } }
export const toMinorUnits = (amount: number) => {
  if (!Number.isFinite(amount) || amount <= 0) throw new FinanceError("Amount must be positive", "invalid_amount");
  return Math.round(amount * 100);
};
export const fromMinorUnits = (amountMinor: number) => amountMinor / 100;

export interface FinanceTransferInput {
  source: { ownerType: FinanceOwnerType; ownerId: string | null };
  destination: { ownerType: FinanceOwnerType; ownerId: string | null };
  amount: number;
  category: FinanceTransactionCategory;
  description: string;
  idempotencyKey: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  createdByProfileId?: string;
  metadata?: Record<string, unknown>;
}

const rpc = async <T>(name: string, args: Record<string, unknown>) => {
  const { data, error } = await (supabase as any).rpc(name, args);
  if (error) throw new FinanceError(error.message, error.code ?? "finance_rpc_failed");
  return data as T;
};

export const financeService = {
  async getOrCreatePrimaryAccount(ownerType: FinanceOwnerType, ownerId: string | null, name?: string) {
    return rpc("get_or_create_primary_financial_account", { p_owner_type: ownerType, p_owner_id: ownerId, p_name: name });
  },
  async credit(ownerType: FinanceOwnerType, ownerId: string, amount: number, category: FinanceTransactionCategory, description: string, idempotencyKey: string, createdByProfileId?: string) {
    return rpc<string>("finance_credit_owner", { p_owner_type: ownerType, p_owner_id: ownerId, p_amount_minor: toMinorUnits(amount), p_category: category, p_description: description, p_idempotency_key: idempotencyKey, p_created_by_profile_id: createdByProfileId });
  },
  async debit(ownerType: FinanceOwnerType, ownerId: string, amount: number, category: FinanceTransactionCategory, description: string, idempotencyKey: string, createdByProfileId?: string) {
    return rpc<string>("finance_debit_owner", { p_owner_type: ownerType, p_owner_id: ownerId, p_amount_minor: toMinorUnits(amount), p_category: category, p_description: description, p_idempotency_key: idempotencyKey, p_created_by_profile_id: createdByProfileId });
  },
  async transfer(input: FinanceTransferInput) {
    if (input.source.ownerType === input.destination.ownerType && input.source.ownerId === input.destination.ownerId) throw new FinanceError("Self transfers are not allowed", "self_transfer");
    return rpc<string>("finance_transfer", { p_source_owner_type: input.source.ownerType, p_source_owner_id: input.source.ownerId, p_destination_owner_type: input.destination.ownerType, p_destination_owner_id: input.destination.ownerId, p_amount_minor: toMinorUnits(input.amount), p_category: input.category, p_description: input.description, p_idempotency_key: input.idempotencyKey, p_related_entity_type: input.relatedEntityType ?? null, p_related_entity_id: input.relatedEntityId ?? null, p_created_by_profile_id: input.createdByProfileId ?? null, p_metadata: input.metadata ?? {} });
  },
  async reserve(ownerType: FinanceOwnerType, ownerId: string, amount: number) { return rpc<void>("finance_reserve_owner", { p_owner_type: ownerType, p_owner_id: ownerId, p_amount_minor: toMinorUnits(amount) }); },
  async releaseReserved(ownerType: FinanceOwnerType, ownerId: string, amount: number) { return rpc<void>("finance_release_reserve_owner", { p_owner_type: ownerType, p_owner_id: ownerId, p_amount_minor: toMinorUnits(amount) }); },
  async captureReserved(ownerType: FinanceOwnerType, ownerId: string, amount: number, category: FinanceTransactionCategory, description: string, idempotencyKey: string, createdByProfileId?: string) {
    await this.releaseReserved(ownerType, ownerId, amount);
    return this.debit(ownerType, ownerId, amount, category, description, idempotencyKey, createdByProfileId);
  },
  async reverse(transactionId: string, idempotencyKey: string, reason: string, createdByProfileId?: string) {
    return rpc<string>("finance_reverse_transaction", { p_transaction_id: transactionId, p_idempotency_key: idempotencyKey, p_reason: reason, p_created_by_profile_id: createdByProfileId ?? null });
  },
};
