import { supabase } from '@/integrations/supabase/client';

export type BandDiscoveryRelation = { band_id: string; shortlisted: boolean; labelmate: boolean };

export async function getBandDiscoveryContext(bandId: string): Promise<BandDiscoveryRelation[]> {
  const { data, error } = await supabase.rpc('get_band_discovery_context', { p_band_id: bandId });
  if (error) throw error;
  return data ?? [];
}

export async function setBandShortlisted(bandId: string, targetBandId: string, saved: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_band_shortlisted', {
    p_band_id: bandId, p_target_band_id: targetBandId, p_saved: saved,
  });
  if (error) throw error;
}
