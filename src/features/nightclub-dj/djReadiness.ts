import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DjMixReadiness {
  booking_id: string;
  status: string;
  count: number;
  needs_count: number;
  deck_a: boolean;
  deck_b: boolean;
  tempo: boolean;
  crossfade: boolean;
  time_span: boolean;
  after_midpoint: boolean;
  past_end: boolean;
  evidence_ready: boolean;
  can_settle: boolean;
}

export type DjReadinessStep = {
  id: string;
  label: string;
  complete: boolean;
};

export function djReadinessSteps(r: DjMixReadiness): DjReadinessStep[] {
  return [
    { id: "count", label: `Six accepted mixer actions (${Math.min(r.count, 6)}/6)`, complete: r.count >= 6 },
    { id: "deck-a", label: "Play a track on Deck A", complete: r.deck_a },
    { id: "deck-b", label: "Play a track on Deck B", complete: r.deck_b },
    { id: "tempo", label: "Adjust the tempo", complete: r.tempo },
    { id: "crossfade", label: "Move the crossfader", complete: r.crossfade },
    { id: "span", label: "Keep mixing for at least one minute", complete: r.time_span },
    { id: "midpoint", label: "Mix again after halfway through the booked set", complete: r.after_midpoint },
  ];
}

export function useDjMixReadiness(bookingId: string | undefined, profileId: string | null) {
  return useQuery<DjMixReadiness | null>({
    queryKey: ["dj-live-readiness", profileId, bookingId],
    enabled: Boolean(bookingId && profileId),
    refetchInterval: 15000,
    queryFn: async () => {
      // The server RPC is SECURITY INVOKER with per-character owner RLS.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("dj_live_mix_readiness", {
        p_booking_id: bookingId,
      });
      if (error) throw error;
      return (data ?? null) as DjMixReadiness | null;
    },
  });
}
