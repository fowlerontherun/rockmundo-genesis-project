import { supabase } from "@/integrations/supabase/client";

export async function leaveBand(userId: string, bandId: string) {
  const { data, error } = await supabase.rpc('leave_band_atomic' as any, {
    p_band_id: bandId,
  });
  if (error) throw error;
  if (data !== true) throw new Error('Band departure was not confirmed');
  return { success: true };
}

export async function transferLeadership(
  bandId: string,
  currentLeaderId: string,
  newLeaderId: string
) {
  const { error } = await supabase.rpc('transfer_band_leadership_atomic' as any, {
    p_band_id: bandId,
    p_current_leader_id: currentLeaderId,
    p_new_leader_id: newLeaderId,
  });
  if (error) throw error;
  return { success: true };
}

export async function disbandBand(bandId: string, leaderId: string) {
  try {
    // 1. Verify leadership
    const { data: band, error: bandError } = await supabase
      .from('bands')
      .select('leader_id, name')
      .eq('id', bandId)
      .single();

    if (bandError) throw bandError;
    if (!band) throw new Error('Band not found');

    if (band.leader_id !== leaderId) {
      throw new Error('Only the band leader can disband the band');
    }

    // 3. Update band status to disbanded
    const { error: updateError } = await supabase
      .from('bands')
      .update({ 
        status: 'disbanded',
        hiatus_started_at: new Date().toISOString()
      })
      .eq('id', bandId);

    if (updateError) throw updateError;

    const { error: historyError } = await supabase.from('band_history').insert({
      band_id: bandId,
      event_type: 'disbanded',
      triggered_by: leaderId,
      event_data: { 
        disbanded_at: new Date().toISOString(),
        band_name: band.name
      }
    });


    if (historyError) throw historyError;
    return { success: true };
  } catch (error) {
    console.error('Error disbanding band:', error);
    throw error;
  }
}

export async function getEligibleLeaders(bandId: string, currentLeaderId: string) {
  try {
    const { data, error } = await supabase
      .from('band_members')
      .select(`
        user_id,
        profiles:user_id(display_name, username)
      `)
      .eq('band_id', bandId)
      .eq('is_touring_member', false)
      .neq('user_id', currentLeaderId);

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error getting eligible leaders:', error);
    throw error;
  }
}
