import { supabase } from "@/integrations/supabase/client";
import { mapBookingError } from "./bookingTypes";
import type { FestivalSetlistItemInput } from "./bookingTypes";

export async function saveFestivalSetlistDraft(input: {
  contractId: string;
  expectedVersion: number;
  items: FestivalSetlistItemInput[];
  idempotencyKey: string;
}) {
  const { data, error } = await supabase.rpc("save_festival_setlist_draft", {
    p_contract_id: input.contractId,
    p_expected_version: input.expectedVersion,
    p_items: input.items,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw mapBookingError(error);
  return data;
}

export async function submitFestivalSetlist(
  setlistId: string,
  idempotencyKey: string,
) {
  const { data, error } = await supabase.rpc("submit_festival_setlist", {
    p_setlist_id: setlistId,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw mapBookingError(error);
  return data;
}

export async function reviewFestivalSetlist(
  setlistId: string,
  action: "approve" | "request_changes",
  reason: string | undefined,
  idempotencyKey: string,
) {
  const { data, error } = await supabase.rpc("review_festival_setlist", {
    p_setlist_id: setlistId,
    p_action: action,
    p_reason: reason ?? null,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw mapBookingError(error);
  return data;
}

export async function lockFestivalSetlist(
  setlistId: string,
  idempotencyKey: string,
) {
  const { data, error } = await supabase.rpc("lock_festival_setlist", {
    p_setlist_id: setlistId,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw mapBookingError(error);
  return data;
}
