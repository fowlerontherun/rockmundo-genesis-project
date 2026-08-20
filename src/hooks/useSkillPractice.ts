import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addHours } from "date-fns";
import { SKILL_PRACTICE_CONFIG } from "@/utils/skillProgressDisplay";

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

export function useSkillPracticeRestrictions(profileId?: string, scheduledDate = new Date()) {
  const dayStart = new Date(Date.UTC(
    scheduledDate.getFullYear(), scheduledDate.getMonth(), scheduledDate.getDate(),
  ));
  const dateKey = dayStart.toISOString().slice(0, 10);
  return useQuery({
    queryKey: ['skill-practice-restrictions', profileId, dateKey],
    queryFn: async (): Promise<PracticeRestrictions> => {
      if (!profileId) {
        return { canPractice: false, reason: 'Not authenticated', todaysPracticeCount: 0, sessionsUsed: 0, sessionsRemaining: 0, maxDailySessions: SKILL_PRACTICE_CONFIG.maxDailySessions, durationOptionsHours: SKILL_PRACTICE_CONFIG.durationOptionsHours, baseXpReward: SKILL_PRACTICE_CONFIG.baseXpReward, minimumSkillLevel: SKILL_PRACTICE_CONFIG.minimumSkillLevel, hasSnookerConflict: false };
      }

      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
      const nextResetAt = dayEnd.toISOString();

      // Get today's scheduled activities using server-derived UTC day boundaries.
      const { data: activities, error } = await supabase
        .from('player_scheduled_activities')
        .select('*')
        .eq('profile_id', profileId)
        .gte('scheduled_start', dayStart.toISOString())
        .lt('scheduled_start', dayEnd.toISOString())
        .in('status', ['scheduled', 'in_progress', 'completed']);

      if (error) throw error;

      // Count skill practice sessions today
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
    staleTime: 1000 * 30, // 30 seconds
  });
}

export function usePracticeSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ skillSlug, scheduledStart }: PracticeSkillData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .is('died_at', null)
        .single();

      if (!profile) throw new Error('Profile not found');

      const scheduledEnd = addHours(scheduledStart, SKILL_PRACTICE_CONFIG.durationOptionsHours[0]);
      const { data, error } = await (supabase as any).rpc('schedule_skill_practice', {
        p_profile_id: profile.id,
        p_skill_slug: skillSlug,
        p_scheduled_start: scheduledStart.toISOString(),
        p_scheduled_end: scheduledEnd.toISOString(),
      });
      if (error) throw new Error(toPracticeBookingMessage(error.message));
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-activities'] });
      queryClient.invalidateQueries({ queryKey: ['week-scheduled-activities'] });
      queryClient.invalidateQueries({ queryKey: ['skill-practice-restrictions'] });
      
      toast.success('Practice scheduled!', {
        description: `${variables.skillName} practice booked`,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to schedule practice', {
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
  return 'The server could not schedule this practice. Please try again.';
}
