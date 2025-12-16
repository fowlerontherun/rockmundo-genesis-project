import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ActivityCategory = 
  | 'financial' 
  | 'progression' 
  | 'status_change' 
  | 'error' 
  | 'admin'
  | 'gig'
  | 'release'
  | 'recording'
  | 'songwriting'
  | 'rehearsal';

export interface GameActivityLog {
  id: string;
  user_id: string;
  band_id?: string;
  activity_type: string;
  activity_category: ActivityCategory;
  description: string;
  metadata?: Record<string, unknown>;
  amount?: number;
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
  created_at: string;
}

interface LogActivityInput {
  userId: string;
  bandId?: string;
  activityType: string;
  activityCategory: ActivityCategory;
  description: string;
  metadata?: Record<string, unknown>;
  amount?: number;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
}

export const useLogActivity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LogActivityInput) => {
      // Use 'as any' to bypass type checking for new table not yet in types
      const { data, error } = await (supabase
        .from('game_activity_logs' as any)
        .insert({
          user_id: input.userId,
          band_id: input.bandId || null,
          activity_type: input.activityType,
          activity_category: input.activityCategory,
          description: input.description,
          metadata: input.metadata || {},
          amount: input.amount || null,
          before_state: input.beforeState || null,
          after_state: input.afterState || null,
        })
        .select()
        .single() as any);

      if (error) {
        console.error('[GameActivityLog] Failed to log activity:', error);
        throw error;
      }
      
      console.info('[GameActivityLog]', {
        type: input.activityType,
        category: input.activityCategory,
        description: input.description,
        amount: input.amount,
      });
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game-activity-logs'] });
    },
  });
};

export const useGameActivityLogs = (userId?: string, limit = 50) => {
  return useQuery({
    queryKey: ['game-activity-logs', userId, limit],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('game_activity_logs' as any)
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(limit) as any);

      if (error) throw error;
      return data as GameActivityLog[];
    },
  });
};

// Helper function for quick logging without hook
export const logGameActivity = async (input: LogActivityInput) => {
  try {
    const { error } = await (supabase
      .from('game_activity_logs' as any)
      .insert({
        user_id: input.userId,
        band_id: input.bandId || null,
        activity_type: input.activityType,
        activity_category: input.activityCategory,
        description: input.description,
        metadata: input.metadata || {},
        amount: input.amount || null,
        before_state: input.beforeState || null,
        after_state: input.afterState || null,
      }) as any);

    if (error) {
      console.error('[GameActivityLog] Failed to log activity:', error);
    } else {
      console.info('[GameActivityLog]', input.activityType, input.description);
    }
  } catch (err) {
    console.error('[GameActivityLog] Error:', err);
  }
};
