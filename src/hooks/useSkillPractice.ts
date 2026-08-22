import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addHours } from "date-fns";
import { SKILL_PRACTICE_CONFIG } from "@/utils/skillProgressDisplay";
import { getActiveProfile } from "@/services/profileService";

interface PracticeSkillData {
  skillSlug: string;
  skillName: string;
  scheduledStart: Date;
}

export interface PracticeRestrictions {
  canPractice: boolean;
  reason?: string;
  todaysPracticeCount: number;
  sessionsUsed: number;
  sessionsRemaining: number;
  maxDailySessions: number;
  durationOptionsHours: readonly number[];
  baseXpReward: number;
  minimumSkillLevel: number;
  nextResetAt?: string;
  hasSnookerConflict: boolean;
}

/**
 * The server applies the practice cap to the UTC date of scheduled_start.
 * Derive the client preflight from the same instant rather than rebuilding a
 * UTC date from local calendar components (which is wrong around BST/DST midnight).
 */
export function practiceUtcDayKey(scheduledDate: Date): string {
  return scheduledDate.toISOString().slice(0, 10);
}

export function useSkillPracticeRestrictions(profileId?: string, scheduledDate = new Date()) {
  const dateKey = practiceUtcDayKey(scheduledDate);
  const dayStart = new Date(`${dateKey}T00:00:00.000Z`);

  return useQuery({
    queryKey: ['skill-practice-restrictions', profileId, dateKey],
    queryFn: async (): Promise<PracticeRestrictions> => {
      if (!profileId) {
        return { canPractice: false, reason: 'Not authenticated', todaysPracticeCount: 0, sessionsUsed: 0, sessionsRemaining: 0, maxDailySessions: SKILL_PRACTICE_CONFIG.maxDailySessions, durationOptionsHours: SKILL_PRACTICE_CONFIG.durationOptionsHours, baseXpReward: SKILL_PRACTICE_CONFIG.baseXpReward, minimumSkillLevel: SKILL_PRACTICE_CONFIG.minimumSkillLevel, hasSnookerConflict: false };
      }

      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
      const nextResetAt = dayEnd.toISOString();

      const { data: activities, error } = await supabase
        .from('player_scheduled_activities')
        .select('activity_type, metadata, scheduled_start, status')
        .eq('profile_id', profileId)
        .gte('scheduled_start', dayStart.toISOString())
        .lt('scheduled_start', dayEnd.toISOString())
        .in('status', ['scheduled', 'in_progress', 'completed']);

      if (error) throw error;

      const todaysPracticeCount = activities?.filter(
        activity => activity.activity_type === 'skill_practice' ||
        (activity.activity_type === 'other' &&
         typeof activity.metadata === 'object' &&
         activity.metadata !== null &&
         'isPractice' in activity.metadata &&
         activity.metadata.isPractice === true)
      ).length || 0;

      let canPractice = true;
      let reason: string | undefined;

      if (todaysPracticeCount >= SKILL_PRACTICE_CONFIG.maxDailySessions) {
        canPractice = false;
        reason = `Daily practice limit reached (${todaysPracticeCount}/${SKILL_PRACTICE_CONFIG.maxDailySessions})`;
      }

      return {
        canPractice,
        reason,
        todaysPracticeCount,
        sessionsUsed: todaysPracticeCount,
        sessionsRemaining: Math.max(0, SKILL_PRACTICE_CONFIG.maxDailySessions - todaysPracticeCount),
        maxDailySessions: SKILL_PRACTICE_CONFIG.maxDailySessions,
        durationOptionsHours: SKILL_PRACTICE_CONFIG.durationOptionsHours,
        baseXpReward: SKILL_PRACTICE_CONFIG.baseXpReward,
        minimumSkillLevel: SKILL_PRACTICE_CONFIG.minimumSkillLevel,
        nextResetAt,
        hasSnookerConflict: false,
      };
    },
    enabled: !!profileId,
    staleTime: 1000 * 30,
  });
}

export function usePracticeSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ skillSlug, scheduledStart }: PracticeSkillData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You need to be signed in to book practice.');

      let profile;
      try {
        profile = await getActiveProfile(user.id);
      } catch {
        throw new Error('The active character could not be verified. Refresh and try again.');
      }
      if (!profile) throw new Error('No active character was found. Switch or create a character first.');

      const scheduledEnd = addHours(scheduledStart, SKILL_PRACTICE_CONFIG.durationOptionsHours[0]);
      const { data, error } = await (supabase as any).rpc('schedule_skill_practice', {
        p_profile_id: profile.id,
        p_skill_slug: skillSlug,
        p_scheduled_start: scheduledStart.toISOString(),
        p_scheduled_end: scheduledEnd.toISOString(),
      });
      if (error) {
        const diagnostic = [error.message, error.details, error.hint, error.code].filter(Boolean).join(' | ');
        throw new Error(toPracticeBookingMessage(diagnostic));
      }
      return data as { sessions_remaining?: number } | null;
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-activities'] });
      queryClient.invalidateQueries({ queryKey: ['week-scheduled-activities'] });
      queryClient.invalidateQueries({ queryKey: ['mobile-day-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['skill-practice-restrictions'] });

      const remaining = result?.sessions_remaining;
      const when = variables.scheduledStart.toLocaleString(undefined, {
        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      });
      toast.success(`${variables.skillName} practice booked`, {
        description: typeof remaining === 'number'
          ? `${when} · ${remaining} of ${SKILL_PRACTICE_CONFIG.maxDailySessions} sessions left that day.`
          : when,
      });
    },
    onError: (error: Error) => {
      toast.error('Practice not booked', {
        description: error.message || 'The server could not schedule this practice. Please try again.',
      });
    },
  });
}

export function toPracticeBookingMessage(message = ''): string {
  if (message.includes('PRACTICE_PAST')) return 'Choose a future practice time.';
  if (message.includes('PRACTICE_CONFLICT')) return 'That time overlaps another scheduled activity.';
  if (message.includes('PRACTICE_DAILY_CAP')) return 'The daily limit of 5 practice sessions has been reached for that date.';
  if (message.includes('PRACTICE_WELLNESS')) return 'Your current wellness prevents training. Visit Wellness to recover.';
  if (message.includes('PRACTICE_SKILL')) return 'This skill is locked or no longer available.';
  if (message.includes('PRACTICE_PROFILE')) return 'The active character could not be verified.';

  // A July 2026 activity-type constraint accidentally removed skill_practice.
  // Surface that deployment/schema drift distinctly instead of hiding it behind
  // a generic booking failure, so mobile and desktop report the same diagnosis.
  if (message.includes('player_scheduled_activities_activity_type_check') || message.includes('23514')) {
    return 'Practice scheduling needs the latest database update. The selected slot has not been booked.';
  }
  if (message.includes('skill_definitions') || message.includes('evaluate_wellness_gate')) {
    return 'Practice scheduling is still using an older server function. The selected slot has not been booked.';
  }
  if (message.includes('schedule_skill_practice') || message.includes('PGRST202') || message.includes('does not exist')) {
    return 'Practice scheduling is not deployed on the server yet. The selected slot has not been booked.';
  }
  return 'The server could not schedule this practice. Please try again.';
}
