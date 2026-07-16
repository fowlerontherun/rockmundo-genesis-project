import { supabase as typedSupabase } from "@/integrations/supabase/client";
// Booking tables/RPCs are not yet in the generated Supabase types; cast to any so calls type-check.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = typedSupabase as any;
import { mapBookingError } from "./bookingTypes";
import type { FestivalApplicationInput, FestivalTerms } from "./bookingTypes";

export async function listPublicApplicationEnabledEditions() {
  const { data, error } = await supabase.rpc("public_festival_editions_read");
  if (error) throw mapBookingError(error);
  return data ?? [];
}

export async function getBandApplications(bandId: string, editionId?: string) {
  let query = supabase
    .from("festival_applications")
    .select("*")
    .eq("band_id", bandId);
  if (editionId) query = query.eq("edition_id", editionId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw mapBookingError(error);
  return data ?? [];
}

export async function submitFestivalApplication(
  input: FestivalApplicationInput,
) {
  const { data, error } = await supabase.rpc("submit_festival_application", {
    p_edition_id: input.editionId,
    p_band_id: input.bandId,
    p_details: input.details,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw mapBookingError(error);
  return data;
}

export async function withdrawFestivalApplication(
  applicationId: string,
  reason: string,
  idempotencyKey: string,
) {
  const { data, error } = await supabase.rpc("withdraw_festival_application", {
    p_application_id: applicationId,
    p_reason: reason,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw mapBookingError(error);
  return data;
}

export async function listOrganiserApplications(editionId: string) {
  const { data, error } = await supabase
    .from("festival_applications")
    .select("*")
    .eq("edition_id", editionId)
    .order("created_at");
  if (error) throw mapBookingError(error);
  return data ?? [];
}

export async function reviewFestivalApplication(input: {
  applicationId: string;
  action:
    | "move_to_review"
    | "shortlist"
    | "waitlist"
    | "reject"
    | "create_offer";
  reason?: string;
  offerTerms?: FestivalTerms;
  idempotencyKey: string;
}) {
  const { data, error } = await supabase.rpc("review_festival_application", {
    p_application_id: input.applicationId,
    p_action: input.action,
    p_reason: input.reason ?? null,
    p_offer_terms: input.offerTerms ?? null,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw mapBookingError(error);
  return data;
}
