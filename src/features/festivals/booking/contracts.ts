import { supabase as typedSupabase } from "@/integrations/supabase/client";
// Booking tables/RPCs are not yet in the generated Supabase types; cast to any so calls type-check.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = typedSupabase as any;
import { mapBookingError } from "./bookingTypes";
import type { BookingSide, FestivalTerms } from "./bookingTypes";

export async function listBandContracts(bandId: string) {
  const { data, error } = await supabase
    .from("festival_contracts")
    .select("*")
    .eq("band_id", bandId)
    .order("created_at", { ascending: false });
  if (error) throw mapBookingError(error);
  return data ?? [];
}

export async function getFestivalContract(contractId: string) {
  const { data, error } = await supabase
    .from("festival_contracts")
    .select("*, festival_contract_signatures(*)")
    .eq("id", contractId)
    .single();
  if (error) throw mapBookingError(error);
  return data;
}

export async function signFestivalContract(input: {
  contractId: string;
  expectedVersion: number;
  signingSide: BookingSide;
  acknowledgement: Record<string, unknown>;
  idempotencyKey: string;
}) {
  const { data, error } = await supabase.rpc("sign_festival_contract", {
    p_contract_id: input.contractId,
    p_expected_contract_version: input.expectedVersion,
    p_signing_side: input.signingSide,
    p_acknowledgement: input.acknowledgement,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw mapBookingError(error);
  return data;
}

export async function amendFestivalContract(
  contractId: string,
  terms: FestivalTerms,
  reason: string,
  idempotencyKey: string,
) {
  const { data, error } = await supabase.rpc("amend_festival_contract", {
    p_contract_id: contractId,
    p_terms: terms,
    p_reason: reason,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw mapBookingError(error);
  return data;
}

export async function cancelFestivalContract(
  contractId: string,
  reason: string,
  idempotencyKey: string,
) {
  const { data, error } = await supabase.rpc("cancel_festival_contract", {
    p_contract_id: contractId,
    p_reason: reason,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw mapBookingError(error);
  return data;
}
