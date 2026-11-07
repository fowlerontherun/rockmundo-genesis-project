import { supabase } from '@/integrations/supabase/client';
export type BandFriendship = {
  band_id: string;
  band_name: string;
  status: 'pending' | 'accepted';
  incoming: boolean;
};
export type FriendshipAction = 'request' | 'accept' | 'decline' | 'remove';

// Keep the feature RPC contract explicit until the next full schema generation.
const friendshipRpc = supabase.rpc.bind(supabase) as unknown as {
  (name: 'list_band_friendships', args: { p_band_id: string }): Promise<{ data: BandFriendship[] | null; error: Error | null }>;
  (name: 'change_band_friendship', args: { p_band_id: string; p_target_band_id: string; p_action: FriendshipAction }): Promise<{ error: Error | null }>;
};
export async function listBandFriendships(bandId: string) {
  const { data, error } = await friendshipRpc('list_band_friendships', { p_band_id: bandId });
  if (error) throw error;
  return data ?? [];
}
export async function changeBandFriendship(bandId: string, targetBandId: string, action: FriendshipAction) {
  const { error } = await friendshipRpc('change_band_friendship', { p_band_id: bandId, p_target_band_id: targetBandId, p_action: action });
  if (error) throw error;
}

export async function searchFriendBands(bandId: string, search: string) {
  const term = search.trim().replace(/[\\%_]/g, '\\$&');
  if (term.length < 2) return [];
  const { data, error } = await supabase.from('bands').select('id,name')
    .neq('id', bandId).eq('status', 'active').ilike('name', `%${term}%`).order('name').limit(20);
  if (error) throw error;
  return data ?? [];
}
