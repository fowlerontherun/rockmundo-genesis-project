// Band-wide activity scheduling utilities
// Ensures all band members are blocked for rehearsals/recordings

import { supabase } from '@/integrations/supabase/client';
import { checkTimeSlotAvailable } from '@/hooks/useActivityBooking';

export interface BandActivityParams {
  bandId: string;
  activityType: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  title: string;
  description?: string;
  location?: string;
  metadata?: Record<string, any>;
  linkedRehearsalId?: string;
  linkedRecordingId?: string;
  linkedGigId?: string;
}

interface ConflictInfo {
  userId: string;
  userName?: string;
  activityTitle: string;
}

/**
 * Get all active REAL band member user IDs (players only, not touring/hired members)
 * Only includes members with user_id (real players) - excludes NPC touring members
 */
export async function getBandMemberUserIds(bandId: string): Promise<string[]> {
  const { data: members, error } = await supabase
    .from('band_members')
    .select('user_id')
    .eq('band_id', bandId)
    .eq('member_status', 'active')
    .eq('is_touring_member', false)
    .not('user_id', 'is', null);  // Only real players
  
  if (error) {
    console.error('Error fetching band members:', error);
    throw error;
  }
  
  return (members || [])
    .map(m => m.user_id)
    .filter((userId): userId is string => userId !== null);
}

/**
 * Get band member details including names for conflict reporting
 * Only includes REAL players (user_id is not null), excludes touring/hired members
 */
export async function getBandMemberDetails(bandId: string): Promise<{ userId: string; name: string }[]> {
  // First get band members - only real players (have user_id)
  const { data: members, error: membersError } = await supabase
    .from('band_members')
    .select('user_id')
    .eq('band_id', bandId)
    .eq('member_status', 'active')
    .eq('is_touring_member', false)
    .not('user_id', 'is', null);  // Only real players
  
  if (membersError) {
    console.error('Error fetching band members:', membersError);
    throw membersError;
  }
  
  const userIds = (members || [])
    .map(m => m.user_id)
    .filter((id): id is string => id !== null);
  
  if (userIds.length === 0) {
    return [];
  }
  
  // Then fetch profiles separately
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('user_id, display_name, username')
    .in('user_id', userIds);
  
  if (profilesError) {
    console.error('Error fetching profiles:', profilesError);
    // Don't throw - just use fallback names
  }
  
  const profileMap = new Map(
    (profiles || []).map(p => [p.user_id, p])
  );
  
  return userIds.map(userId => {
    const profile = profileMap.get(userId);
    const name = profile?.display_name || profile?.username || 'Band member';
    return { userId, name };
  });
}

/**
 * Check if all band members are available for a time slot
 */
export async function checkBandAvailability(
  bandId: string,
  start: Date,
  end: Date,
  excludeActivityId?: string
): Promise<{ available: boolean; conflicts: ConflictInfo[] }> {
  const memberDetails = await getBandMemberDetails(bandId);
  const conflicts: ConflictInfo[] = [];
  
  for (const member of memberDetails) {
    const { available, conflictingActivity } = await checkTimeSlotAvailable(
      member.userId, 
      start, 
      end,
      excludeActivityId
    );
    
    if (!available) {
      conflicts.push({
        userId: member.userId,
        userName: member.name,
        activityTitle: conflictingActivity?.title || 'Unknown activity'
      });
    }
  }
  
  return {
    available: conflicts.length === 0,
    conflicts
  };
}

/**
 * Format conflict information for user display
 */
export function formatConflictMessage(conflicts: ConflictInfo[], currentUserId?: string): string {
  if (conflicts.length === 0) return '';
  
  if (conflicts.length === 1) {
    const conflict = conflicts[0];
    // Highlight if it's the current user
    const isYou = currentUserId && conflict.userId === currentUserId;
    const name = isYou ? 'You have' : `${conflict.userName} has`;
    return `${name} "${conflict.activityTitle}" scheduled at this time.`;
  }
  
  // Check if current user is among the conflicts
  const hasCurrentUser = currentUserId && conflicts.some(c => c.userId === currentUserId);
  if (hasCurrentUser) {
    const otherNames = conflicts
      .filter(c => c.userId !== currentUserId)
      .map(c => c.userName)
      .join(', ');
    if (otherNames) {
      return `You and ${otherNames} have scheduling conflicts at this time.`;
    }
    return `You have a scheduling conflict at this time.`;
  }
  
  const names = conflicts.map(c => c.userName).join(', ');
  return `Multiple band members have scheduling conflicts: ${names}`;
}

/**
 * Create scheduled activities for ALL band members
 * This ensures every member is blocked during band activities
 */
export async function createBandScheduledActivities(params: BandActivityParams): Promise<string[]> {
  const memberIds = await getBandMemberUserIds(params.bandId);
  
  if (memberIds.length === 0) {
    console.warn('No active band members found for band:', params.bandId);
    return [];
  }
  
  // Fetch profile IDs for each member (required by the table schema)
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, user_id')
    .in('user_id', memberIds);
  
  if (profileError) {
    console.error('Error fetching profiles for band members:', profileError);
    throw new Error('Failed to fetch member profiles');
  }
  
  const profileMap = new Map(
    (profiles || []).map(p => [p.user_id, p.id])
  );
  
  // Filter to only members with valid profiles
  const validMembers = memberIds.filter(userId => profileMap.has(userId));
  
  if (validMembers.length === 0) {
    console.warn('No valid profiles found for band members');
    return [];
  }
  
  // Create activity for each band member
  const insertData = validMembers.map(userId => ({
    user_id: userId,
    profile_id: profileMap.get(userId),
    activity_type: params.activityType,
    scheduled_start: params.scheduledStart.toISOString(),
    scheduled_end: params.scheduledEnd.toISOString(),
    title: params.title,
    description: params.description || null,
    location: params.location || null,
    metadata: {
      ...params.metadata,
      band_id: params.bandId,
      is_band_activity: true,
    },
    linked_rehearsal_id: params.linkedRehearsalId || null,
    linked_recording_id: params.linkedRecordingId || null,
    linked_gig_id: params.linkedGigId || null,
    status: 'scheduled',
  }));
  
  const { data, error } = await supabase
    .from('player_scheduled_activities' as any)
    .insert(insertData)
    .select('id');
  
  if (error) {
    console.error('Failed to create band scheduled activities:', error);
    throw new Error('Failed to schedule activity for all band members');
  }
  
  console.log(`Created ${data?.length || 0} scheduled activities for band ${params.bandId}`);
  return (data || []).map((d: any) => d.id);
}

/**
 * Delete all scheduled activities for a band event
 * Useful when cancelling a rehearsal or recording
 */
export async function deleteBandScheduledActivities(
  bandId: string,
  linkedRehearsalId?: string,
  linkedRecordingId?: string
): Promise<void> {
  let query = supabase
    .from('player_scheduled_activities' as any)
    .delete()
    .contains('metadata', { band_id: bandId });
  
  if (linkedRehearsalId) {
    query = query.eq('linked_rehearsal_id', linkedRehearsalId);
  }
  if (linkedRecordingId) {
    query = query.eq('linked_recording_id', linkedRecordingId);
  }
  
  const { error } = await query;
  
  if (error) {
    console.error('Failed to delete band scheduled activities:', error);
    throw error;
  }
}
