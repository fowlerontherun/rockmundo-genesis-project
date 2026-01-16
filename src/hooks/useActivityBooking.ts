import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { ActivityType } from "./useScheduledActivities";

export interface BookingParams {
  userId?: string;
  bandId?: string;
  activityType: ActivityType;
  scheduledStart: Date;
  scheduledEnd: Date;
  title: string;
  description?: string;
  location?: string;
  metadata?: Record<string, any>;
  linkedGigId?: string;
  linkedRehearsalId?: string;
  linkedRecordingId?: string;
  linkedJobShiftId?: string;
  linkedOpenMicId?: string;
}

/**
 * Check if a time slot is available for booking
 */
export async function checkTimeSlotAvailable(
  userId: string,
  start: Date,
  end: Date,
  excludeId?: string
): Promise<{ available: boolean; conflictingActivity?: any }> {
  const { data: hasConflict } = await (supabase as any).rpc('check_scheduling_conflict', {
    p_user_id: userId,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
    p_exclude_id: excludeId || null,
  });

  if (hasConflict) {
    // Get the conflicting activity details
    const { data: conflict } = await (supabase as any)
      .from('player_scheduled_activities')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['scheduled', 'in_progress'])
      .or(`and(scheduled_start.lte.${start.toISOString()},scheduled_end.gt.${start.toISOString()}),and(scheduled_start.lt.${end.toISOString()},scheduled_end.gte.${end.toISOString()}),and(scheduled_start.gte.${start.toISOString()},scheduled_end.lte.${end.toISOString()})`)
      .limit(1)
      .single();

    return { available: false, conflictingActivity: conflict };
  }

  return { available: true };
}

/**
 * Create a scheduled activity entry
 */
export async function createScheduledActivity(params: BookingParams): Promise<string> {
  // Validate that the scheduled start is in the future
  const now = new Date();
  if (params.scheduledStart <= now) {
    throw new Error('Cannot book activities in the past. Please select a future time slot.');
  }

  let userId = params.userId;
  
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    userId = user.id;
  }

  // Check for conflicts
  const { available, conflictingActivity } = await checkTimeSlotAvailable(
    userId,
    params.scheduledStart,
    params.scheduledEnd
  );

  if (!available) {
    throw new Error(
      `Time slot conflict: You have "${conflictingActivity?.title}" scheduled at this time.`
    );
  }

  const { data: activity, error } = await (supabase as any)
    .from('player_scheduled_activities')
    .insert({
      user_id: userId,
      activity_type: params.activityType,
      scheduled_start: params.scheduledStart.toISOString(),
      scheduled_end: params.scheduledEnd.toISOString(),
      title: params.title,
      description: params.description,
      location: params.location,
      metadata: {
        ...params.metadata,
        band_id: params.bandId,
        linked_open_mic_id: params.linkedOpenMicId,
      },
      linked_gig_id: params.linkedGigId,
      linked_rehearsal_id: params.linkedRehearsalId,
      linked_recording_id: params.linkedRecordingId,
      linked_job_shift_id: params.linkedJobShiftId,
    })
    .select()
    .single();

  if (error) throw error;

  toast({
    title: "Activity Scheduled",
    description: `${params.title} has been added to your schedule.`,
  });

  return activity.id;
}

/**
 * Check if user can start an activity now (no conflicts)
 */
export async function canStartActivityNow(userId: string): Promise<{ canStart: boolean; reason?: string }> {
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

  const { data: activeActivities } = await (supabase as any)
    .from('player_scheduled_activities')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['scheduled', 'in_progress'])
    .lte('scheduled_start', oneHourLater.toISOString())
    .gte('scheduled_end', now.toISOString())
    .limit(1);

  if (activeActivities && activeActivities.length > 0) {
    const activity = activeActivities[0];
    return {
      canStart: false,
      reason: `You have "${activity.title}" ${activity.status === 'in_progress' ? 'in progress' : 'scheduled'} until ${new Date(activity.scheduled_end).toLocaleTimeString()}`
    };
  }

  return { canStart: true };
}
