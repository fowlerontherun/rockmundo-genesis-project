import { supabase } from '@/integrations/supabase/client';
export async function playTogetherRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>;
  const { data, error } = await rpc(name, args);
  if (error) throw error;
  return data as T;
}
export type ProposalDate = { slot_id: string; gig_id: string; scheduled_date: string; scheduled_end: string | null; venue_name: string; city_name: string; revenue_share: number; travel_minutes_from_previous: number };
export type TourProposal = { id: string; tour_id: string; tour_name: string; headliner_band_id: string; support_band_id: string; headliner_name: string; support_name: string; display_status: string; slot_ids: string[]; itinerary: ProposalDate[]; note: string; expires_at: string };
export const listTourProposals = (bandId: string) => playTogetherRpc<TourProposal[]>('list_support_tour_proposals', { p_band_id: bandId });
export const createTourProposal = (headlinerBandId: string, tourId: string, supportBandId: string, gigIds: string[], requestId: string, note: string) => playTogetherRpc<string>('create_support_tour_proposal', { p_headliner_band_id: headlinerBandId, p_tour_id: tourId, p_support_band_id: supportBandId, p_gig_ids: gigIds, p_request_id: requestId, p_note: note });
export const respondTourProposal = (id: string, action: 'accept' | 'decline' | 'withdraw') => playTogetherRpc<string>('respond_support_tour_proposal', { p_id: id, p_action: action });

/** Page the world catalogue so countries beyond the API row cap remain selectable. */
export async function listPlayTogetherCities() {
  const rows: { id: string; name: string; country: string | null }[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('cities').select('id,name,country').order('country').order('name').order('id').range(offset, offset+499);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < 500) return { data: rows, error: null };
  }
}
