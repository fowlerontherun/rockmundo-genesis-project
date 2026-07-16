import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HabitTemplate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  target_per_week: number;
  stat_bonus: Record<string, number>;
  streak_bonus: Record<string, Record<string, number>>;
  sort_order: number;
}

export interface PlayerHabit {
  id: string;
  template_slug: string | null;
  name: string;
  description: string | null;
  category: string | null;
  target_per_week: number | null;
  is_active: boolean;
  current_streak: number;
  best_streak: number;
  last_completed_date: string | null;
}

export function useHabitTemplates() {
  return useQuery({
    queryKey: ["wellness-habit-templates"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("wellness_habit_templates")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as HabitTemplate[];
    },
  });
}

export function usePlayerHabits(profileId: string | null | undefined) {
  return useQuery({
    queryKey: ["player-habits", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("player_habits")
        .select("id, template_slug, name, description, category, target_per_week, is_active, current_streak, best_streak, last_completed_date")
        .eq("profile_id", profileId)
        .eq("is_active", true)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as PlayerHabit[];
    },
  });
}

export function useStartHabit(profileId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (templateSlug: string) => {
      const { data, error } = await (supabase as any).rpc("start_wellness_habit", { _template_slug: templateSlug });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["player-habits", profileId] }),
  });
}

export function useCompleteHabit(profileId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (habitId: string) => {
      const { data, error } = await (supabase as any).rpc("complete_wellness_habit", { _habit_id: habitId });
      if (error) throw error;
      return data as { ok: boolean; streak: number; reason?: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["player-habits", profileId] }),
  });
}

export function useStopHabit(profileId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (habitId: string) => {
      const { error } = await (supabase as any).rpc("stop_wellness_habit", { _habit_id: habitId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["player-habits", profileId] }),
  });
}
