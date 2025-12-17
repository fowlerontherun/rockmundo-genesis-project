import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useToast } from "@/hooks/use-toast";

export interface RandomEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  option_a_text: string;
  option_a_effects: Record<string, number>;
  option_a_outcome_text: string;
  option_b_text: string;
  option_b_effects: Record<string, number>;
  option_b_outcome_text: string;
}

export interface PlayerEvent {
  id: string;
  user_id: string;
  event_id: string;
  triggered_at: string;
  choice_made: "a" | "b" | null;
  choice_made_at: string | null;
  outcome_applied: boolean;
  outcome_applied_at: string | null;
  outcome_effects: Record<string, number> | null;
  outcome_message: string | null;
  status: "pending_choice" | "awaiting_outcome" | "completed" | "expired";
  random_events?: RandomEvent;
}

export function usePlayerEvents() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["player-events", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("player_events")
        .select(`
          *,
          random_events (*)
        `)
        .eq("user_id", user.id)
        .order("triggered_at", { ascending: false });

      if (error) throw error;
      return data as PlayerEvent[];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60, // 1 minute
  });
}

export function usePendingEvent() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["pending-event", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("player_events")
        .select(`
          *,
          random_events (*)
        `)
        .eq("user_id", user.id)
        .eq("status", "pending_choice")
        .order("triggered_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as PlayerEvent | null;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60 * 5, // Check every 5 minutes
  });
}

export function useChooseEventOption() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ playerEventId, choice }: { playerEventId: string; choice: "a" | "b" }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("choose-event-option", {
        body: { playerEventId, choice },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: "Choice Made!",
        description: data.message || "Your outcome will be applied tomorrow.",
      });
      queryClient.invalidateQueries({ queryKey: ["pending-event", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["player-events", user?.id] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to make choice",
        variant: "destructive",
      });
    },
  });
}

export function useRecentEventOutcomes() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["recent-event-outcomes", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from("player_events")
        .select(`
          *,
          random_events (*)
        `)
        .eq("user_id", user.id)
        .eq("status", "completed")
        .gte("outcome_applied_at", threeDaysAgo)
        .order("outcome_applied_at", { ascending: false });

      if (error) throw error;
      return data as PlayerEvent[];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
