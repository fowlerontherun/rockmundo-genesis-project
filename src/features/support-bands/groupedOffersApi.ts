import { supabase } from '@/integrations/supabase/client';
export type SupportOfferSnapshot = {
  slot_id: string; gig_id: string; tour_id: string; scheduled_date: string;
  scheduled_end: string | null; venue_id: string; revenue_share: number;
};
const rpc = supabase.rpc.bind(supabase) as unknown as {
  (name: 'create_tour_support_offers', args: { p_headliner_band_id: string; p_tour_id: string; p_support_band_id: string; p_gig_ids: string[]; p_request_id: string }): Promise<{ data: number; error: Error | null }>;
  (name: 'respond_to_tour_support_offers', args: { p_offers: SupportOfferSnapshot[]; p_action: 'accept' | 'decline' }): Promise<{ data: number; error: Error | null }>;
};
export async function createTourSupportOffers(headlinerBandId: string, tourId: string, supportBandId: string, gigIds: string[], requestId: string) {
  const { data, error } = await rpc('create_tour_support_offers', { p_headliner_band_id: headlinerBandId, p_tour_id: tourId, p_support_band_id: supportBandId, p_gig_ids: gigIds, p_request_id: requestId });
  if (error) throw error;
  return data;
}
export async function respondToTourSupportOffers(offers: SupportOfferSnapshot[], action: 'accept' | 'decline') {
  const { data, error } = await rpc('respond_to_tour_support_offers', { p_offers: offers, p_action: action });
  if (error) throw error;
  return data;
}
