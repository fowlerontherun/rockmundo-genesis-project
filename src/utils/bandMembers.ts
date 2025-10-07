import { supabase } from "@/integrations/supabase/client";
import { updateBandChemistry } from "./bandChemistry";

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

    // 5. Update chemistry (-10 for member leaving)
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
  try {
    // 1. Verify current leader
    const { data: band, error: bandError } = await supabase
      .from('bands')
      .select('leader_id, name')
      .eq('id', bandId)
      .single();

    if (bandError) throw bandError;
    if (!band) throw new Error('Band not found');

    if (band.leader_id !== currentLeaderId) {
      throw new Error('Only the current leader can transfer leadership');
    }

    // 2. Verify new leader is a human member
    const { data: newLeader, error: memberError } = await supabase
      .from('band_members')
      .select('*')
      .eq('band_id', bandId)
      .eq('user_id', newLeaderId)
      .eq('is_touring_member', false)
      .single();

    if (memberError || !newLeader) {
      throw new Error('New leader must be a human band member');
    }

    // 3. Transfer leadership
    const { error: updateError } = await supabase
      .from('bands')
      .update({ leader_id: newLeaderId })
      .eq('id', bandId);

    if (updateError) throw updateError;

    // 4. Update chemistry (-5 for leadership change)
    await updateBandChemistry(bandId, 'LEADER_CHANGED', { 
      from: currentLeaderId, 
      to: newLeaderId 
    });

    // 5. Log event
    await supabase.from('band_history').insert({
      band_id: bandId,
      event_type: 'leadership_transfer',
      triggered_by: currentLeaderId,
      event_data: { 
        new_leader_id: newLeaderId,
        transferred_at: new Date().toISOString()
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Error transferring leadership:', error);
    throw error;
  }
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

    // 2. Log the disbanding before doing it
    await supabase.from('band_history').insert({
      band_id: bandId,
      event_type: 'disbanded',
      triggered_by: leaderId,
      event_data: { 
        disbanded_at: new Date().toISOString(),
        band_name: band.name
      }
    });

    // 3. Update band status to disbanded
    const { error: updateError } = await supabase
      .from('bands')
      .update({ 
        status: 'disbanded',
        hiatus_started_at: new Date().toISOString()
      })
      .eq('id', bandId);

    if (updateError) throw updateError;

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
    return [];
  }
}
