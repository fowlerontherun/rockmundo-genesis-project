import { supabase } from "@/integrations/supabase/client";
import { updateBandChemistry } from "./bandChemistry";
import { handleMemberLeaveOwnership } from "./bandRoyalties";

export async function leaveBand(userId: string, bandId: string) {
  try {
    // 1. Get band and member info
    const { data: band, error: bandError } = await supabase
      .from('bands')
      .select('leader_id, is_solo_artist, name')
      .eq('id', bandId)
      .single();

    if (bandError) throw bandError;
    if (!band) throw new Error('Band not found');

    // 2. Prevent leader from leaving without transfer
    if (band.leader_id === userId) {
      throw new Error('Band leaders must transfer leadership before leaving');
    }

    // 3. Prevent solo artists from leaving their own band
    if (band.is_solo_artist) {
      throw new Error('Solo artists cannot leave their own band. Use disband instead.');
    }

    // 4. Remove member
    const { error: deleteError } = await supabase
      .from('band_members')
      .delete()
      .eq('band_id', bandId)
      .eq('user_id', userId);

    if (deleteError) throw deleteError;

    // 5. Update song ownership (reduce to 30% retention)
    await handleMemberLeaveOwnership(userId, bandId);

    // 6. Update chemistry (-10 for member leaving)
    await updateBandChemistry(bandId, 'MEMBER_LEFT', { userId });

    // 6. Log event
    await supabase.from('band_history').insert({
      band_id: bandId,
      event_type: 'member_left',
      triggered_by: userId,
      event_data: { left_at: new Date().toISOString() }
    });

    return { success: true };
  } catch (error) {
    console.error('Error leaving band:', error);
    throw error;
  }
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
