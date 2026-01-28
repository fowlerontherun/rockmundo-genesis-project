import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";

interface ScheduleConflict {
  hasConflict: boolean;
  conflictingActivities: Array<{
    id: string;
    activity_type: string;
    scheduled_start: string;
    scheduled_end: string;
    title: string;
    description?: string;
  }>;
}

export const useFestivalScheduleConflict = (
  festivalStartDate?: string,
  festivalEndDate?: string,
  enabled = true
) => {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["festival-schedule-conflict", festivalStartDate, festivalEndDate, user?.id],
    queryFn: async (): Promise<ScheduleConflict> => {
      if (!user?.id || !festivalStartDate || !festivalEndDate) {
        return { hasConflict: false, conflictingActivities: [] };
      }

      // Query player_scheduled_activities for overlapping time slots
      const { data: conflicts, error } = await (supabase as any)
        .from("player_scheduled_activities")
        .select("id, activity_type, scheduled_start, scheduled_end, status, title, description")
        .eq("user_id", user.id)
        .neq("status", "completed")
        .neq("status", "cancelled")
        .lte("scheduled_start", festivalEndDate)
        .gte("scheduled_end", festivalStartDate);

      if (error) {
        console.error("Error checking schedule conflict:", error);
        return { hasConflict: false, conflictingActivities: [] };
      }

      const conflictingActivities = (conflicts || []).map((activity: any) => ({
        id: activity.id,
        activity_type: activity.activity_type,
        scheduled_start: activity.scheduled_start,
        scheduled_end: activity.scheduled_end,
        title: activity.title,
        description: activity.description || getActivityDescription(activity.activity_type),
      }));

      return {
        hasConflict: conflictingActivities.length > 0,
        conflictingActivities,
      };
    },
    enabled: enabled && !!user?.id && !!festivalStartDate && !!festivalEndDate,
  });

  return {
    hasConflict: data?.hasConflict ?? false,
    conflictingActivities: data?.conflictingActivities ?? [],
    isChecking: isLoading,
  };
};

function getActivityDescription(activityType: string): string {
  const descriptions: Record<string, string> = {
    gig: "Gig performance",
    tour: "Tour date",
    recording: "Recording session",
    rehearsal: "Band rehearsal",
    travel: "Travel",
    work: "Work shift",
    university: "University class",
    songwriting: "Songwriting session",
    pr_campaign: "PR Campaign",
    busking: "Busking",
    open_mic: "Open mic",
    festival: "Festival performance",
  };
  return descriptions[activityType] || activityType;
}

export const useCheckFestivalConflict = () => {
  const { user } = useAuth();

  const checkConflict = async (startDate: string, endDate: string): Promise<ScheduleConflict> => {
    if (!user?.id) {
      return { hasConflict: false, conflictingActivities: [] };
    }

    try {
      const { data: conflicts, error } = await (supabase as any)
        .from("player_scheduled_activities")
        .select("id, activity_type, scheduled_start, scheduled_end, status, title, description")
        .eq("user_id", user.id)
        .neq("status", "completed")
        .neq("status", "cancelled")
        .lte("scheduled_start", endDate)
        .gte("scheduled_end", startDate);

      if (error) throw error;

      const conflictingActivities = (conflicts || []).map((activity: any) => ({
        id: activity.id,
        activity_type: activity.activity_type,
        scheduled_start: activity.scheduled_start,
        scheduled_end: activity.scheduled_end,
        title: activity.title,
        description: activity.description || getActivityDescription(activity.activity_type),
      }));

      return {
        hasConflict: conflictingActivities.length > 0,
        conflictingActivities,
      };
    } catch (error) {
      console.error("Error checking schedule conflict:", error);
      return { hasConflict: false, conflictingActivities: [] };
    }
  };

  return { checkConflict };
};
