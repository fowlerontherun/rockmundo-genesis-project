import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { toast } from "sonner";

export interface FestivalAttendance {
  id: string;
  festival_id: string;
  user_id: string;
  current_stage_id: string | null;
  joined_at: string;
  last_moved_at: string;
  is_active: boolean;
}

export const useFestivalAttendance = (festivalId: string | undefined) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: attendance, isLoading } = useQuery<FestivalAttendance | null>({
    queryKey: ["festival-attendance", festivalId, user?.id],
    queryFn: async () => {
      if (!festivalId || !user?.id) return null;
      const { data, error } = await (supabase as any)
        .from("festival_attendance")
        .select("*")
        .eq("festival_id", festivalId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!festivalId && !!user?.id,
  });

  const { data: stageAttendees = [] } = useQuery<{ current_stage_id: string; count: number }[]>({
    queryKey: ["festival-stage-attendees", festivalId],
    queryFn: async () => {
      if (!festivalId) return [];
      const { data, error } = await (supabase as any)
        .from("festival_attendance")
        .select("current_stage_id")
        .eq("festival_id", festivalId)
        .eq("is_active", true);
      if (error) throw error;
      // Count per stage
      const counts: Record<string, number> = {};
      (data || []).forEach((a: any) => {
        if (a.current_stage_id) {
          counts[a.current_stage_id] = (counts[a.current_stage_id] || 0) + 1;
        }
      });
      return Object.entries(counts).map(([current_stage_id, count]) => ({
        current_stage_id,
        count,
      }));
    },
    enabled: !!festivalId,
  });

  const joinFestival = useMutation({
    mutationFn: async ({ festivalId, stageId }: { festivalId: string; stageId: string }) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data, error } = await (supabase as any)
        .from("festival_attendance")
        .upsert({
          festival_id: festivalId,
          user_id: user.id,
          current_stage_id: stageId,
          is_active: true,
          last_moved_at: new Date().toISOString(),
        }, { onConflict: "festival_id,user_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["festival-attendance", festivalId] });
      queryClient.invalidateQueries({ queryKey: ["festival-stage-attendees", festivalId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const moveToStage = useMutation({
    mutationFn: async (stageId: string) => {
      if (!user?.id || !festivalId) throw new Error("Missing context");
      const { data, error } = await (supabase as any)
        .from("festival_attendance")
        .update({
          current_stage_id: stageId,
          last_moved_at: new Date().toISOString(),
        })
        .eq("festival_id", festivalId)
        .eq("user_id", user.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["festival-attendance", festivalId] });
      queryClient.invalidateQueries({ queryKey: ["festival-stage-attendees", festivalId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const leaveFestival = useMutation({
    mutationFn: async () => {
      if (!user?.id || !festivalId) throw new Error("Missing context");
      const { error } = await (supabase as any)
        .from("festival_attendance")
        .update({ is_active: false })
        .eq("festival_id", festivalId)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["festival-attendance", festivalId] });
      queryClient.invalidateQueries({ queryKey: ["festival-stage-attendees", festivalId] });
      toast.success("Left the festival");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    attendance,
    stageAttendees,
    isLoading,
    joinFestival,
    moveToStage,
    leaveFestival,
    isAtFestival: attendance?.is_active ?? false,
    currentStageId: attendance?.current_stage_id ?? null,
  };
};
