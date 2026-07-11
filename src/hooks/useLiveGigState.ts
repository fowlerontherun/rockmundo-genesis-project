import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useLiveGigState = (
  gigId: string | null,
  enabled = true,
  onChanged?: () => void,
) => {
  useEffect(() => {
    if (!gigId || !enabled) return;

    const channel = supabase
      .channel(`live-gig-state-${gigId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "gigs", filter: `id=eq.${gigId}` }, () => onChanged?.())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gig_song_performances" }, () => onChanged?.())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, gigId, onChanged]);
};

export const useRealtimeGigAdvancement = useLiveGigState;
