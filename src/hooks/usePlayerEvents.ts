import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/hooks/use-toast";

export interface RandomEvent {
  id: string;
  title: string;
  description: string;
  category: string | null;
  is_common: boolean | null;
  option_a_text: string;
  option_b_text: string;
  option_a_outcome_text: string | null;
  option_b_outcome_text: string | null;
  option_a_effects: Record<string, number> | null;
  option_b_effects: Record<string, number> | null;
}

export type PlayerEventStatus = "pending_choice" | "awaiting_outcome" | "completed";

export interface PlayerEvent {
  id: string;
  user_id: string;
  profile_id: string | null;
  event_id: string;
  status: PlayerEventStatus;
  choice_made: "a" | "b" | null;
  choice_made_at: string | null;
  outcome_applied: boolean;
  outcome_message: string | null;
  outcome_effects: Record<string, number> | null;
  triggered_at: string;
  created_at: string;
  random_events: RandomEvent | null;
}

const EVENT_SELECT = `
  id, user_id, profile_id, event_id, status, choice_made, choice_made_at,
  outcome_applied, outcome_message, outcome_effects, triggered_at, created_at,
  random_events (
    id, title, description, category, is_common,
    option_a_text, option_b_text,
    option_a_outcome_text, option_b_outcome_text,
    option_a_effects, option_b_effects
  )
`;

/** All events for the signed-in account's active character. */
export function usePlayerEvents() {
  const { userId, profileId } = useActiveProfile();

  return useQuery({
    queryKey: ["player-events", userId, profileId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await (supabase as any)
        .from("player_events")
        .select(EVENT_SELECT)
        .eq("user_id", userId)
        .order("triggered_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      const rows = (data ?? []) as PlayerEvent[];
      // Legacy rows have no profile_id — keep them visible.
      return rows.filter((r) => !r.profile_id || !profileId || r.profile_id === profileId);
    },
    enabled: !!userId,
    staleTime: 1000 * 30,
  });
}

/** The single event that is waiting for the player to make a choice. */
export function usePendingEvent() {
  const { userId, profileId } = useActiveProfile();

  return useQuery({
    queryKey: ["pending-event", userId, profileId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await (supabase as any)
        .from("player_events")
        .select(EVENT_SELECT)
        .eq("user_id", userId)
        .eq("status", "pending_choice")
        .order("triggered_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      const rows = (data ?? []) as PlayerEvent[];
      const match = rows.filter((r) => !r.profile_id || !profileId || r.profile_id === profileId);
      return match[0] ?? null;
    },
    enabled: !!userId,
    staleTime: 1000 * 15,
    refetchInterval: 1000 * 60 * 2,
  });
}

/** Events where the choice is made but the outcome has not landed yet. */
export function useAwaitingOutcomeEvents() {
  const events = usePlayerEvents();
  return {
    ...events,
    data: (events.data ?? []).filter((e) => e.status === "awaiting_outcome"),
  };
}

export function useChooseEventOption() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ eventId, option }: { eventId: string; option: "a" | "b" }) => {
      const { data, error } = await supabase.functions.invoke("choose-event-option", {
        body: { playerEventId: eventId, choice: option },
      });

      if (error) throw error;
      if (data && (data as any).error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player-events"] });
      queryClient.invalidateQueries({ queryKey: ["pending-event"] });
      queryClient.invalidateQueries({ queryKey: ["pending-random-events"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to record your choice",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

/** Recently resolved outcomes, newest first. */
export function useRecentEventOutcomes(limit = 5) {
  const events = usePlayerEvents();
  return {
    ...events,
    data: (events.data ?? [])
      .filter((e) => e.status === "completed" && !!e.outcome_message)
      .slice(0, limit),
  };
}
