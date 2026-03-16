import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/hooks/use-toast";

export interface RandomEvent {
  id: string;
  name: string;
  description: string;
  option_a_text: string;
  option_b_text: string;
  success_chance_a: number;
  success_chance_b: number;
  success_result_a: string;
  success_result_b: string;
  failure_result_a: string;
  failure_result_b: string;
  image_url: string | null;
  event_type: string | null;
}

interface PlayerEvent {
  id: string;
  profile_id: string;
  random_event_id: string;
  status: "pending_choice" | "completed";
  chosen_option: "a" | "b" | null;
  success: boolean | null;
  result_text: string | null;
  triggered_at: string;
  random_events: RandomEvent;
}

export function usePlayerEvents() {
  const { profileId } = useActiveProfile();

  return useQuery({
    queryKey: ["player-events", profileId],
    queryFn: async () => {
      if (!profileId) return [];

      const { data, error } = await (supabase as any)
        .from("player_events")
        .select(`*, random_events (*)`)
        .eq("profile_id", profileId)
        .order("triggered_at", { ascending: false });

      if (error) throw error;
      return data as PlayerEvent[];
    },
    enabled: !!profileId,
    staleTime: 1000 * 60,
  });
}

export function usePendingEvent() {
  const { profileId } = useActiveProfile();

  return useQuery({
    queryKey: ["pending-event", profileId],
    queryFn: async () => {
      if (!profileId) return null;

      const { data, error } = await (supabase as any)
        .from("player_events")
        .select(`*, random_events (*)`)
        .eq("profile_id", profileId)
        .eq("status", "pending_choice")
        .order("triggered_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as PlayerEvent | null;
    },
    enabled: !!profileId,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60 * 5,
  });
}

export function useChooseEventOption() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ eventId, option }: { eventId: string; option: "a" | "b" }) => {
      const { data, error } = await (supabase as any).from("player_events").update({
        status: "completed",
        chosen_option: option,
      }).eq("id", eventId);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player-events"] });
      queryClient.invalidateQueries({ queryKey: ["pending-event"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to choose event option",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useRecentEventOutcomes() {
  const { profileId } = useActiveProfile();

  return useQuery({
    queryKey: ["recent-event-outcomes", profileId],
    queryFn: async () => {
      if (!profileId) return [];

      const { data, error } = await (supabase as any)
        .from("player_events")
        .select(`*, random_events (*)`)
        .eq("profile_id", profileId)
        .eq("status", "completed")
        .not("result_text", "is", null)
        .order("triggered_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as PlayerEvent[];
    },
    enabled: !!profileId,
    staleTime: 1000 * 60 * 5,
  });
}
