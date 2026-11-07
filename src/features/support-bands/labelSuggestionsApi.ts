import { supabase } from '@/integrations/supabase/client';
export type LabelSuggestion = {
  id: string; label_id: string; label_name: string; headliner_band_id: string; support_band_id: string;
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
