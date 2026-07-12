import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addHours } from "date-fns";
import { SKILL_PRACTICE_CONFIG } from "@/utils/skillProgressDisplay";
import { useCreateScheduledActivity } from "./useScheduledActivities";

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

export function useSkillPracticeRestrictions(userId?: string) {
  return useQuery({
    queryKey: ['skill-practice-restrictions', userId],
    queryFn: async (): Promise<PracticeRestrictions> => {
      if (!userId) {
        return { canPractice: false, reason: 'Not authenticated', todaysPracticeCount: 0, sessionsUsed: 0, sessionsRemaining: 0, maxDailySessions: SKILL_PRACTICE_CONFIG.maxDailySessions, durationOptionsHours: SKILL_PRACTICE_CONFIG.durationOptionsHours, baseXpReward: SKILL_PRACTICE_CONFIG.baseXpReward, minimumSkillLevel: SKILL_PRACTICE_CONFIG.minimumSkillLevel, hasSnookerConflict: false };
      }

      let serverNow = new Date();
      try {
        const serverTimeResponse = await (supabase as any).rpc("get_server_time");
        if (serverTimeResponse?.data) serverNow = new Date(String(serverTimeResponse.data));
      } catch {
        // Fall back to client formatting only when the server-time RPC is unavailable.
      }
      const dayStart = new Date(serverNow);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
      const nextResetAt = dayEnd.toISOString();

      // Get today's scheduled activities using server-derived UTC day boundaries.
      const { data: activities, error } = await supabase
        .from('player_scheduled_activities')
        .select('*')
        .eq('user_id', userId)
        .gte('scheduled_start', dayStart.toISOString())
        .lt('scheduled_start', dayEnd.toISOString())
        .in('status', ['scheduled', 'in_progress']);

      if (error) throw error;

      // Check for snooker activity
      const hasSnookerConflict = activities?.some(
        activity => activity.activity_type === 'other' && 
        typeof activity.metadata === 'object' && 
        activity.metadata !== null &&
        'activityName' in activity.metadata &&
        String(activity.metadata.activityName).toLowerCase().includes('snooker')
      ) || false;

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

      if (hasSnookerConflict) {
        canPractice = false;
        reason = 'Cannot practice while snooker activity is scheduled';
      } else if (todaysPracticeCount >= SKILL_PRACTICE_CONFIG.maxDailySessions) {
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
        hasSnookerConflict,
      };
    },
    enabled: !!userId,
    staleTime: 1000 * 30, // 30 seconds
  });
}

export function usePracticeSkill() {
  const queryClient = useQueryClient();
  const createActivity = useCreateScheduledActivity();

  return useMutation({
    mutationFn: async ({ skillSlug, skillName, scheduledStart }: PracticeSkillData) => {
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

      // Get skill progress to verify level
      const { data: skillProgress } = await supabase
        .from('skill_progress')
        .select('current_level')
        .eq('profile_id', profile.id)
        .eq('skill_slug', skillSlug)
        .maybeSingle();

      if (!skillProgress || skillProgress.current_level < SKILL_PRACTICE_CONFIG.minimumSkillLevel) {
        throw new Error('Skill must be at least level 1 to practice');
      }

      const scheduledEnd = addHours(scheduledStart, SKILL_PRACTICE_CONFIG.durationOptionsHours[0]);

      // Create scheduled activity
      return createActivity.mutateAsync({
        activity_type: 'skill_practice',
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        title: `Practice ${skillName}`,
        description: `Skill practice session for ${skillName}`,
        metadata: {
          isPractice: true,
          skillSlug,
          skillName,
          xpReward: SKILL_PRACTICE_CONFIG.baseXpReward,
        },
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-activities'] });
      queryClient.invalidateQueries({ queryKey: ['week-scheduled-activities'] });
      queryClient.invalidateQueries({ queryKey: ['skill-practice-restrictions'] });
      
      toast.success('Practice scheduled!', {
        description: `${variables.skillName} practice booked`,
      });
    },
    onError: (error: any) => {
      toast.error('Failed to schedule practice', {
        description: error.message,
      });
    },
  });
}

export function useCompletePracticeSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ activityId, skillSlug }: { activityId: string; skillSlug: string }) => {
      // Award XP through progression function
      const { error: xpError } = await supabase.functions.invoke('progression', {
        body: {
          action: 'spend_skill_xp',
          skill_slug: skillSlug,
          xp: SKILL_PRACTICE_CONFIG.baseXpReward,
          metadata: {
            activity: 'practice',
            source: 'scheduled_practice',
          },
        },
      });

      if (xpError) throw xpError;

      // Mark activity as completed
      const { error: activityError } = await supabase
        .from('player_scheduled_activities')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', activityId);

      if (activityError) throw activityError;

      return { activityId, skillSlug };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gameData'] });
      queryClient.invalidateQueries({ queryKey: ['skillProgress'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-activities'] });
      
      toast.success('Practice completed!', {
        description: `Gained ${SKILL_PRACTICE_CONFIG.baseXpReward} XP`,
      });
    },
    onError: (error: any) => {
      toast.error('Failed to complete practice', {
        description: error.message,
      });
    },
  });
}
