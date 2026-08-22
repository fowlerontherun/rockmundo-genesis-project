import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type PendingTravel = {
  id: string;
  status: string;
  scheduled_departure_time: string | null;
  arrival_time: string | null;
};

/**
 * Watches only the active character's pending travel marker. The authoritative
 * departure/arrival transition is still performed by the existing
 * `complete-travel` server function; this hook merely refreshes mobile caches
 * after that server state changes while the app remains open.
 */
export function useTravelLifecycleRefresh(
  profileId?: string | null,
  refetchGameData?: () => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  const previousSignature = useRef<string | null | undefined>(undefined);

  const state = useQuery({
    queryKey: ["mobile-travel-lifecycle", profileId],
    enabled: !!profileId,
    staleTime: 10_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    queryFn: async (): Promise<PendingTravel | null> => {
      if (!profileId) return null;
      const { data, error } = await (supabase as any)
        .from("player_travel_history")
        .select("id,status,scheduled_departure_time,arrival_time")
        .eq("profile_id", profileId)
        .in("status", ["scheduled", "in_progress"])
        .order("scheduled_departure_time", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as PendingTravel | null) ?? null;
    },
  });

  useEffect(() => {
    if (!profileId) {
      previousSignature.current = undefined;
      return;
    }
    if (state.isLoading || state.isFetching || state.isError) return;

    const signature = state.data ? `${state.data.id}:${state.data.status}` : null;
    if (previousSignature.current === undefined) {
      previousSignature.current = signature;
      return;
    }
    if (previousSignature.current === signature) return;

    previousSignature.current = signature;
    void Promise.all([
      refetchGameData?.() ?? Promise.resolve(),
      queryClient.invalidateQueries({ queryKey: ["mobile-travel-state"] }),
      queryClient.invalidateQueries({ queryKey: ["mobile-day-schedule"] }),
      queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] }),
      queryClient.invalidateQueries({ queryKey: ["week-scheduled-activities"] }),
      queryClient.invalidateQueries({ queryKey: ["upcoming-travel"] }),
    ]);
  }, [profileId, queryClient, refetchGameData, state.data, state.isError, state.isFetching, state.isLoading]);

  return state;
}
