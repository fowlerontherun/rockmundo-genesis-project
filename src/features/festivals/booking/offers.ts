import { supabase } from '@/integrations/supabase/client';
import { mapBookingError } from './bookingTypes';
import type { FestivalTerms } from './bookingTypes';

export async function createFestivalOffer(input: { editionId: string; bandId: string; applicationId?: string; terms: FestivalTerms; idempotencyKey: string }) {
  const { data, error } = await supabase.rpc('create_festival_offer', {
    p_edition_id: input.editionId,
    p_band_id: input.bandId,
    p_application_id: input.applicationId ?? null,
    p_terms: input.terms,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw mapBookingError(error);
  return data;
}

export async function counterFestivalOffer(input: { offerId: string; expectedRevision: number; terms: FestivalTerms; changeSummary?: string; idempotencyKey: string }) {
  const { data, error } = await supabase.rpc('counter_festival_offer', {
    p_offer_id: input.offerId,
    p_expected_revision: input.expectedRevision,
    p_terms: input.terms,
    p_change_summary: input.changeSummary ?? null,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw mapBookingError(error);
  return data;
}

export async function acceptFestivalOffer(offerId: string, revision: number, idempotencyKey: string) {
  const { data, error } = await supabase.rpc('accept_festival_offer', {
    p_offer_id: offerId,
    p_revision_number: revision,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw mapBookingError(error);
  return data;
}

export async function declineFestivalOffer(offerId: string, reason: string, idempotencyKey: string) {
  const { data, error } = await supabase.rpc('decline_festival_offer', {
    p_offer_id: offerId,
    p_reason: reason,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw mapBookingError(error);
  return data;
}

export async function listFestivalOffers(bandId?: string, editionId?: string) {
  let query = supabase.from('festival_contract_offers').select('*, festival_offer_revisions(*)');
  if (bandId) query = query.eq('band_id', bandId);
  if (editionId) query = query.eq('edition_id', editionId);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw mapBookingError(error);
  return data ?? [];
}
