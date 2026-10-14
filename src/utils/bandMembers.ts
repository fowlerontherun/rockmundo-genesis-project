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
  const { data, error } = await (supabase as any).rpc('disband_band_atomic', {
    p_band_id: bandId,
    p_leader_profile_id: leaderId,
  });
  if (error) throw error;
  if (data !== true) throw new Error('Band disbanding was not confirmed');
  return { success: true };
}

export async function getEligibleLeaders(bandId: string, currentLeaderId: string) {
  // Both leader_id and band_members.profile_id are character UUIDs. Join the
  // actual profile FK, not user_id (which references auth.users).
  const { data, error } = await supabase
    .from('band_members')
    .select(`
      profile_id,
      profiles:profiles!band_members_profile_id_fkey!inner(display_name,username)
    `)
    .eq('band_id', bandId)
    .eq('member_status', 'active')
    .eq('is_touring_member', false)
    .neq('profile_id', currentLeaderId)
    .eq('profiles.is_active', true)
    .is('profiles.deleted_at', null)
    .is('profiles.died_at', null);

  if (error) throw error;
  return (data ?? []).filter((member) => Boolean(member.profile_id));
}
