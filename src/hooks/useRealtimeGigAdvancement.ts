import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Read-only compatibility hook for legacy callers.
 * Phase 5 PR 04 moved gig advancement to server workers/RPCs; this hook only
 * subscribes to authoritative gig/performance changes and emits a refetch event.
 */
export const useRealtimeGigAdvancement = (gigId: string | null, enabled: boolean = true) => {
  useEffect(() => {
    if (!gigId || !enabled) return;

    const notify = () => {
      window.dispatchEvent(new CustomEvent("rockmundo:gig-progress-updated", { detail: { gigId } }));
    };

    const gigChannel = supabase
      .channel(`gig-progress-${gigId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "gigs", filter: `id=eq.${gigId}` }, notify)
      .subscribe();

    const perfChannel = supabase
      .channel(`gig-performance-progress-${gigId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "gig_song_performances" }, notify)
      .subscribe();

    return () => {
      supabase.removeChannel(gigChannel);
      supabase.removeChannel(perfChannel);
    };
  }, [gigId, enabled]);
};

export const useLiveGigState = useRealtimeGigAdvancement;
