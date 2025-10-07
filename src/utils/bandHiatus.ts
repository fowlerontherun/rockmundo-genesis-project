import { supabase } from "@/integrations/supabase/client";
import { updateBandChemistry } from "./bandChemistry";
import { getUserActiveBand } from "./bandStatus";

export interface HiatusOptions {
  bandId: string;
  reason: string;
  duration?: number; // Duration in days, optional
  leaderId: string;
}

export interface ReactivationResult {
  success: boolean;
  conflicts?: Array<{
    userId: string;
    userName: string;
    conflictBandId: string;
    conflictBandName: string;
  }>;
}

export async function putBandOnHiatus(options: HiatusOptions) {
  const { bandId, reason, duration, leaderId } = options;

  try {
    // 1. Calculate expiration if duration provided
    const hiatusEndsAt = duration 
      ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000)
      : null;

    // 2. Remove all touring members (AI members)
    const { data: touringMembers } = await supabase
      .from('band_members')
      .select('id, user_id')
      .eq('band_id', bandId)
      .eq('is_touring_member', true);

    if (touringMembers && touringMembers.length > 0) {
      await supabase
        .from('band_members')
        .delete()
        .in('id', touringMembers.map(m => m.id));
    }

    // 3. Update band status
    const { error: updateError } = await supabase
      .from('bands')
      .update({
        status: 'on_hiatus',
        hiatus_started_at: new Date().toISOString(),
        hiatus_reason: reason,
        hiatus_ends_at: hiatusEndsAt?.toISOString() || null,
        hiatus_notification_sent: false
      })
      .eq('id', bandId);

    if (updateError) throw updateError;

    // 4. Log event in band history
    await supabase.from('band_history').insert({
      band_id: bandId,
      event_type: 'hiatus_start',
      triggered_by: leaderId,
      event_data: { 
        reason, 
        duration, 
        touring_members_removed: touringMembers?.length || 0,
        hiatus_ends_at: hiatusEndsAt?.toISOString() || null
      }
    });

    // 5. Update chemistry (hiatus causes small chemistry loss)
    await updateBandChemistry(bandId, 'LEADER_CHANGED', { 
      context: 'hiatus_start',
      reason 
    });

    return { success: true };
  } catch (error) {
    console.error('Error putting band on hiatus:', error);
    throw error;
  }
}

export async function reactivateBand(
  bandId: string, 
  leaderId: string
): Promise<ReactivationResult> {
  try {
    // 1. Get all human members of the band
    const { data: members, error: membersError } = await supabase
      .from('band_members')
      .select('user_id')
      .eq('band_id', bandId)
      .eq('is_touring_member', false);

    if (membersError) throw membersError;

    // 2. Check for conflicts with other active bands
    const conflicts = [];
    for (const member of members || []) {
      const activeBand = await getUserActiveBand(member.user_id);
      if (activeBand && activeBand.id !== bandId) {
        // Fetch profile for display name
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, username')
          .eq('user_id', member.user_id)
          .single();
        
        conflicts.push({
          userId: member.user_id,
          userName: profile?.display_name || profile?.username || 'Unknown',
          conflictBandId: activeBand.id,
          conflictBandName: activeBand.name
        });
      }
    }

    // 3. If there are conflicts, return them for resolution
    if (conflicts.length > 0) {
      return { success: false, conflicts };
    }

    // 4. No conflicts - reactivate the band
    const { error: updateError } = await supabase
      .from('bands')
      .update({
        status: 'active',
        hiatus_started_at: null,
        hiatus_reason: null,
        hiatus_ends_at: null,
        hiatus_notification_sent: false
      })
      .eq('id', bandId);

    if (updateError) throw updateError;

    // 5. Log reactivation event
    await supabase.from('band_history').insert({
      band_id: bandId,
      event_type: 'hiatus_end',
      triggered_by: leaderId,
      event_data: { reactivated_at: new Date().toISOString() }
    });

    // 6. Boost chemistry for successful reactivation
    await updateBandChemistry(bandId, 'WEEK_TOGETHER', {
      context: 'hiatus_end'
    });

    return { success: true };
  } catch (error) {
    console.error('Error reactivating band:', error);
    throw error;
  }
}

export async function resolveReactivationConflict(
  userId: string,
  reactivatingBandId: string,
  conflictBandId: string,
  action: 'hiatus' | 'resign'
) {
  try {
    if (action === 'hiatus') {
      // Put the conflicting band on hiatus
      await putBandOnHiatus({
        bandId: conflictBandId,
        reason: 'Automatically put on hiatus due to band reactivation',
        leaderId: userId
      });
    } else if (action === 'resign') {
      // Remove user from the reactivating band
      await supabase
        .from('band_members')
        .delete()
        .eq('band_id', reactivatingBandId)
        .eq('user_id', userId);

      // Log the resignation
      await supabase.from('band_history').insert({
        band_id: reactivatingBandId,
        event_type: 'member_left',
        triggered_by: userId,
        event_data: { 
          reason: 'Chose to stay with other band during reactivation conflict' 
        }
      });

      // Update chemistry for member leaving
      await updateBandChemistry(reactivatingBandId, 'MEMBER_LEFT', { userId });
    }

    return { success: true };
  } catch (error) {
    console.error('Error resolving reactivation conflict:', error);
    throw error;
  }
}
