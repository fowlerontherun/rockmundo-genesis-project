// Band-wide activity scheduling utilities
// Ensures all band members are blocked for rehearsals/recordings

import { supabase } from '@/integrations/supabase/client';
import { checkTimeSlotAvailable } from '@/hooks/useActivityBooking';
import { pushNotification } from '@/lib/notify';

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
  /** Members (profile ids) deliberately left out because they were unavailable. */
  skipProfileIds?: string[];
}


interface ProfileSummary {
  user_id: string;
  display_name: string | null;
  username: string | null;
}

export interface ConflictInfo {
  userId: string;
  profileId?: string;
  userName?: string;
  activityTitle: string;
  activityType?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
}

/**
 * Thrown when one or more band members are busy. Carries the full conflict
 * detail so the UI can show which member clashes with which activity and let a
 * band leader proceed without them.
 */
export class BandUnavailableError extends Error {
  conflicts: ConflictInfo[];
  constructor(conflicts: ConflictInfo[], message?: string) {
    super(message || formatConflictMessage(conflicts));
    this.name = 'BandUnavailableError';
    this.conflicts = conflicts;
  }
}

export function isBandUnavailableError(error: unknown): error is BandUnavailableError {
  return error instanceof BandUnavailableError
    || (typeof error === 'object' && error !== null && (error as any).name === 'BandUnavailableError');
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  rehearsal: 'Rehearsal',
  recording: 'Recording session',
  gig: 'Gig',
  tour: 'Tour date',
  songwriting: 'Songwriting session',
  jam_session: 'Jam session',
  travel: 'Travel',
  employment: 'Work shift',
  education: 'Class',
  wellness: 'Wellness activity',
  festival: 'Festival appearance',
};

export function describeActivityType(activityType?: string | null): string {
  if (!activityType) return 'Activity';
  return ACTIVITY_TYPE_LABELS[activityType]
    || activityType.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export function formatConflictWindow(conflict: ConflictInfo): string {
  if (!conflict.scheduledStart) return '';
  const start = new Date(conflict.scheduledStart);
  const end = conflict.scheduledEnd ? new Date(conflict.scheduledEnd) : null;
  const time = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const day = start.toLocaleDateString([], { day: 'numeric', month: 'short' });
  return end ? `${day} ${time(start)}–${time(end)}` : `${day} ${time(start)}`;
}


export interface ScheduleLikeActivity {
  id: string;
  activity_type?: string | null;
  linked_rehearsal_id?: string | null;
  linked_recording_id?: string | null;
  metadata?: Record<string, any> | null;
}

function getBandActivityKey(activity: ScheduleLikeActivity): string | null {
  if (activity.linked_rehearsal_id) return `rehearsal:${activity.linked_rehearsal_id}`;
  if (activity.linked_recording_id) return `recording:${activity.linked_recording_id}`;
  const metadata = activity.metadata || {};
  if (metadata.rehearsalId) return `rehearsal:${metadata.rehearsalId}`;
  if (metadata.sessionId && activity.activity_type === 'recording') return `recording:${metadata.sessionId}`;
  return null;
}

export function withoutDuplicateBandScheduleActivities<T extends ScheduleLikeActivity>(activities: T[]): T[] {
  const seen = new Set<string>();
  return activities.filter((activity) => {
    const key = getBandActivityKey(activity);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
 * Get band member details including names for conflict reporting.
 * Returns per-character profile_ids (NOT auth user_ids) so conflict checks
 * are scoped to a specific character — a user's other characters in other
 * bands must not block this band's scheduling.
 */
export async function getBandMemberDetails(bandId: string): Promise<{ profileId: string; userId: string | null; name: string }[]> {
  const { data: members, error: membersError } = await supabase
    .from('band_members')
    .select('profile_id, user_id')
    .eq('band_id', bandId)
    .eq('member_status', 'active')
    .eq('is_touring_member', false)
    .not('profile_id', 'is', null);

  if (membersError) {
    console.error('Error fetching band members:', membersError);
    throw membersError;
  }

  const rows = (members || []).filter((m: any) => m.profile_id) as { profile_id: string; user_id: string | null }[];
  if (rows.length === 0) return [];

  const profileIds = rows.map(r => r.profile_id);
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, display_name, username')
    .in('id', profileIds);

  if (profilesError) {
    console.error('Error fetching profiles:', profilesError);
  }

  const profileMap = new Map<string, { display_name: string | null; username: string | null }>(
    (profiles || []).map((p: any) => [p.id, { display_name: p.display_name, username: p.username }])
  );

  return rows.map(r => {
    const p = profileMap.get(r.profile_id);
    return {
      profileId: r.profile_id,
      userId: r.user_id,
      name: p?.display_name || p?.username || 'Band member',
    };
  });
}

/**
 * Check if all band members are available for a time slot.
 * Uses profile_id so a member's OTHER characters do not create false conflicts.
 */
export async function checkBandAvailability(
  bandId: string,
  start: Date,
  end: Date,
  excludeActivityId?: string
): Promise<{ available: boolean; conflicts: ConflictInfo[] }> {
  const memberDetails = await getBandMemberDetails(bandId);
  if (memberDetails.length === 0) {
    return { available: true, conflicts: [] };
  }

  const profileIds = memberDetails.map(m => m.profileId);

  let query = (supabase as any)
    .from('player_scheduled_activities')
    .select('id, profile_id, title, activity_type, scheduled_start, scheduled_end, status')
    .in('profile_id', profileIds)
    .in('status', ['scheduled', 'in_progress'])
    .lt('scheduled_start', end.toISOString())
    .gt('scheduled_end', start.toISOString());

  if (excludeActivityId) {
    query = query.neq('id', excludeActivityId);
  }

  const { data: overlapping, error } = await query;
  if (error) {
    console.warn('Band availability check failed, allowing booking:', error);
    return { available: true, conflicts: [] };
  }

  const conflicts: ConflictInfo[] = [];
  const seen = new Set<string>();
  for (const row of (overlapping || []) as any[]) {
    if (seen.has(row.profile_id)) continue;
    seen.add(row.profile_id);
    const member = memberDetails.find(m => m.profileId === row.profile_id);
    conflicts.push({
      userId: member?.userId || row.profile_id,
      profileId: row.profile_id,
      userName: member?.name,
      activityTitle: row.title || 'Unknown activity',
      activityType: row.activity_type ?? null,
      scheduledStart: row.scheduled_start ?? null,
      scheduledEnd: row.scheduled_end ?? null,
    });
  }

  return { available: conflicts.length === 0, conflicts };
}

/**
 * Describe a single conflict, e.g.
 * "Jimmy — Recording session "Abbey Road" (14:00–18:00)"
 */
export function formatConflictLine(conflict: ConflictInfo, currentProfileId?: string | null): string {
  const isYou = currentProfileId && conflict.profileId === currentProfileId;
  const who = isYou ? 'You' : (conflict.userName || 'Band member');
  const what = describeActivityType(conflict.activityType);
  const when = formatConflictWindow(conflict);
  const title = conflict.activityTitle && conflict.activityTitle !== 'Unknown activity'
    ? ` “${conflict.activityTitle}”`
    : '';
  return `${who} — ${what}${title}${when ? ` (${when})` : ''}`;
}

/**
 * Format conflict information for user display, naming each member and the
 * activity that clashes.
 */
export function formatConflictMessage(conflicts: ConflictInfo[], currentProfileId?: string | null): string {
  if (conflicts.length === 0) return '';
  const lines = conflicts.map(c => formatConflictLine(c, currentProfileId));
  if (conflicts.length === 1) {
    return `${lines[0]} is already booked at this time.`;
  }
  return `${conflicts.length} band members are unavailable: ${lines.join('; ')}.`;
}


/**
 * Create scheduled activities for ALL band members
 * This ensures every member is blocked during band activities
 */
export async function createBandScheduledActivities(params: BandActivityParams): Promise<string[]> {
  // Fetch band members with their profile_ids (character-scoped, not auth-scoped)
  const { data: members, error: membersError } = await supabase
    .from('band_members')
    .select('profile_id, user_id')
    .eq('band_id', params.bandId)
    .eq('member_status', 'active')
    .eq('is_touring_member', false)
    .not('profile_id', 'is', null);

  if (membersError) {
    console.error('Error fetching band members:', membersError);
    throw new Error('Failed to fetch band members');
  }

  const skipSet = new Set(params.skipProfileIds || []);
  const validMembers = ((members || []) as any[])
    .filter(m => m.profile_id && !skipSet.has(m.profile_id))
    .map(m => ({ profileId: m.profile_id as string, userId: (m.user_id as string | null) ?? null }));

  if (validMembers.length === 0) {
    console.warn('No active band members with profiles found for band:', params.bandId);
    return [];
  }


  const profileIds = validMembers.map(m => m.profileId);

  let existingQuery = supabase
    .from('player_scheduled_activities' as any)
    .select('profile_id')
    .in('profile_id', profileIds)
    .eq('activity_type', params.activityType)
    .neq('status', 'cancelled');

  if (params.linkedRehearsalId) {
    existingQuery = existingQuery.eq('linked_rehearsal_id', params.linkedRehearsalId);
  } else if (params.linkedRecordingId) {
    existingQuery = existingQuery.eq('linked_recording_id', params.linkedRecordingId);
  } else {
    existingQuery = existingQuery
      .eq('scheduled_start', params.scheduledStart.toISOString())
      .eq('scheduled_end', params.scheduledEnd.toISOString())
      .contains('metadata', { band_id: params.bandId });
  }

  const { data: existingActivities, error: existingError } = await existingQuery;
  if (existingError) {
    console.error('Failed to check existing band scheduled activities:', existingError);
    throw new Error('Failed to verify existing band schedule entries');
  }

  const alreadyScheduled = new Set((existingActivities || []).map((activity: any) => activity.profile_id));
  const membersToSchedule = validMembers.filter(m => !alreadyScheduled.has(m.profileId));

  if (membersToSchedule.length === 0) {
    return [];
  }

  const insertData = membersToSchedule.map(m => ({
    user_id: m.userId,
    profile_id: m.profileId,
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

export interface AbsentMemberNotificationParams {
  bandId: string;
  bandName?: string | null;
  activityType: string;
  activityLabel: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  location?: string | null;
  conflicts: ConflictInfo[];
  linkedRehearsalId?: string | null;
  linkedRecordingId?: string | null;
  actionPath?: string | null;
}

/**
 * Notify members who were left out of a band booking, telling them what they
 * clash with and giving them a path to opt back in.
 */
export async function notifyAbsentBandMembers(params: AbsentMemberNotificationParams): Promise<void> {
  const when = formatConflictWindow({
    activityTitle: params.activityLabel,
    userId: '',
    scheduledStart: params.scheduledStart.toISOString(),
    scheduledEnd: params.scheduledEnd.toISOString(),
  });
  const label = describeActivityType(params.activityType);

  await Promise.all(params.conflicts.map(async (conflict) => {
    if (!conflict.userId) return;
    await pushNotification({
      userId: conflict.userId,
      profileId: conflict.profileId ?? null,
      category: 'social',
      type: 'warning',
      title: `${label} booked without you`,
      message: `${params.bandName || 'Your band'} booked "${params.activityLabel}"${when ? ` for ${when}` : ''}${params.location ? ` at ${params.location}` : ''}. You were busy with ${describeActivityType(conflict.activityType)}${conflict.activityTitle ? ` “${conflict.activityTitle}”` : ''}. You can still join if you free up your schedule.`,
      actionPath: params.actionPath ?? '/rehearsals',
      metadata: {
        band_id: params.bandId,
        activity_type: params.activityType,
        rehearsal_id: params.linkedRehearsalId ?? null,
        recording_id: params.linkedRecordingId ?? null,
        scheduled_start: params.scheduledStart.toISOString(),
        scheduled_end: params.scheduledEnd.toISOString(),
        can_join_late: true,
      },
    });
  }));
}

/**
 * Let a member who was skipped opt back into a band activity. Fails if they
 * still have a clashing activity in that window.
 */
export async function joinBandActivityLate(options: {
  profileId: string;
  userId?: string | null;
  bandId: string;
  activityType: string;
  title: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  location?: string | null;
  linkedRehearsalId?: string | null;
  linkedRecordingId?: string | null;
  metadata?: Record<string, any>;
}): Promise<{ joined: boolean; reason?: string }> {
  const { data: clashes, error: clashError } = await (supabase as any)
    .from('player_scheduled_activities')
    .select('id, title, activity_type, scheduled_start, scheduled_end, linked_rehearsal_id, linked_recording_id')
    .eq('profile_id', options.profileId)
    .in('status', ['scheduled', 'in_progress'])
    .lt('scheduled_start', options.scheduledEnd.toISOString())
    .gt('scheduled_end', options.scheduledStart.toISOString());

  if (clashError) {
    return { joined: false, reason: 'Could not verify your schedule. Try again.' };
  }

  const linkedId = options.linkedRehearsalId || options.linkedRecordingId;
  const existing = (clashes || []) as any[];
  const alreadyIn = existing.find((row) =>
    (options.linkedRehearsalId && row.linked_rehearsal_id === options.linkedRehearsalId)
    || (options.linkedRecordingId && row.linked_recording_id === options.linkedRecordingId));
  if (alreadyIn) return { joined: true };

  if (existing.length > 0) {
    const blocking = existing[0];
    return {
      joined: false,
      reason: `You still have ${describeActivityType(blocking.activity_type)}${blocking.title ? ` “${blocking.title}”` : ''} booked in this window. Cancel it first.`,
    };
  }

  const { error } = await (supabase as any)
    .from('player_scheduled_activities')
    .insert({
      user_id: options.userId ?? null,
      profile_id: options.profileId,
      activity_type: options.activityType,
      scheduled_start: options.scheduledStart.toISOString(),
      scheduled_end: options.scheduledEnd.toISOString(),
      title: options.title,
      location: options.location ?? null,
      metadata: {
        ...(options.metadata || {}),
        band_id: options.bandId,
        is_band_activity: true,
        joined_late: true,
        linked_id: linkedId ?? null,
      },
      linked_rehearsal_id: options.linkedRehearsalId ?? null,
      linked_recording_id: options.linkedRecordingId ?? null,
      status: 'scheduled',
    });

  if (error) {
    console.error('Failed to join band activity late:', error);
    return { joined: false, reason: 'Could not add you to the session.' };
  }

  return { joined: true };
}
