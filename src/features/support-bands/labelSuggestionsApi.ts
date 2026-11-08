import { supabase } from '@/integrations/supabase/client';
export type LabelSuggestion = {
  id: string; label_id: string; label_name: string; headliner_band_id: string; support_band_id: string;
  tour_id?: string | null; gig_id?: string | null; tour_name?: string | null; invited_dates?: number; confirmed_dates?: number;
  headliner_name: string; support_name: string; note: string; roster_current: boolean;
  headliner_response: 'pending' | 'interested' | 'declined'; support_response: 'pending' | 'interested' | 'declined';
};
const rpc = supabase.rpc.bind(supabase) as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>;
async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) throw error;
  return data as T;
}
export const getLabelSuggestionRoster = (labelId: string) => call<{ id: string; name: string }[]>('get_label_play_together_roster', { p_label_id: labelId });
export const listLabelSuggestions = (scope: { labelId: string } | { bandId: string }) => call<LabelSuggestion[]>('list_label_play_together',
  'labelId' in scope ? { p_label_id: scope.labelId } : { p_band_id: scope.bandId });
export const suggestLabelPairing = (labelId: string, headliner: string, support: string, note: string) => call<string>('suggest_label_play_together',
  { p_label_id: labelId, p_headliner_band_id: headliner, p_support_band_id: support, p_note: note });
export const respondToLabelSuggestion = (id: string, bandId: string, response: 'interested' | 'declined') => call<void>('respond_to_label_play_together',
  { p_suggestion_id: id, p_band_id: bandId, p_response: response });

export type LabelBookingOptions = { tours: { id: string; name: string }[]; gigs: { id: string; name: string }[] };
export const getLabelBookingOptions = (labelId: string, bandId: string) => call<LabelBookingOptions>('label_play_together_booking_options', { p_label_id: labelId, p_headliner_band_id: bandId });
export const suggestLabelBookingPairing = (labelId: string, headliner: string, support: string, note: string, tourId: string | null, gigId: string | null) => call<string>('suggest_label_pairing_for_booking', { p_label_id: labelId, p_headliner_band_id: headliner, p_support_band_id: support, p_note: note, p_tour_id: tourId, p_gig_id: gigId });
