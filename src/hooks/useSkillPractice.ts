import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { startOfDay, endOfDay, addHours } from "date-fns";
import { useCreateScheduledActivity } from "./useScheduledActivities";

interface PracticeSkillData {
  skillSlug: string;
  skillName: string;
  scheduledStart: Date;
}

interface PracticeRestrictions {
  canPractice: boolean;
  reason?: string;
  todaysPracticeCount: number;
  hasSnookerConflict: boolean;
}

export function useSkillPracticeRestrictions(userId?: string, currentDate?: Date) {
  return useQuery({
    queryKey: ['skill-practice-restrictions', userId, currentDate?.toISOString()],
    queryFn: async (): Promise<PracticeRestrictions> => {
      if (!userId || !currentDate) {
        return { canPractice: false, reason: 'Not authenticated', todaysPracticeCount: 0, hasSnookerConflict: false };
      }

      const dayStart = startOfDay(currentDate);
      const dayEnd = endOfDay(currentDate);

      // Get today's scheduled activities
      const { data: activities, error } = await supabase
        .from('player_scheduled_activities')
        .select('*')
        .eq('user_id', userId)
        .gte('scheduled_start', dayStart.toISOString())
        .lte('scheduled_start', dayEnd.toISOString())
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
      } else if (todaysPracticeCount >= 5) {
        canPractice = false;
        reason = 'Daily practice limit reached (5/5)';
      }

      return {
        canPractice,
        reason,
        todaysPracticeCount,
        hasSnookerConflict,
      };
    },
    enabled: !!userId && !!currentDate,
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
        .single();

      if (!profile) throw new Error('Profile not found');

      // Get skill progress to verify level
      const { data: skillProgress } = await supabase
        .from('skill_progress')
        .select('current_level')
        .eq('profile_id', profile.id)
        .eq('skill_slug', skillSlug)
        .maybeSingle();

      if (!skillProgress || skillProgress.current_level < 1) {
        throw new Error('Skill must be at least level 1 to practice');
      }

      const scheduledEnd = addHours(scheduledStart, 1);

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
          xpReward: 5,
        },
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-activities'] });
      queryClient.invalidateQueries({ queryKey: ['week-scheduled-activities'] });
      queryClient.invalidateQueries({ queryKey: ['skill-practice-restrictions'] });
      
      toast.success('Practice scheduled!', {
        description: `${variables.skillName} practice booked for 1 hour`,
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
          xp: 5,
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
        description: 'Gained 5 XP',
      });
    },
    onError: (error: any) => {
      toast.error('Failed to complete practice', {
        description: error.message,
      });
    },
  });
}
