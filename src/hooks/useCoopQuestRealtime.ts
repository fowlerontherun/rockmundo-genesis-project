import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";

/**
 * Subscribes to realtime changes on coop_quest_events and coop_quests so the
 * activity feed, per-friend log and details drawer stay live without manual
 * refreshes. We invalidate the relevant React Query keys when changes arrive.
 *
 * The subscription is enabled while there is an active profile. RLS still
 * scopes which rows the client actually sees.
 */
export function useCoopQuestRealtime() {
  const { profileId } = useActiveProfile();
  const qc = useQueryClient();

  useEffect(() => {
    if (!profileId) return;

    const channel = supabase
      .channel(`coop-quest-realtime:${profileId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "coop_quest_events" },
        () => {
          qc.invalidateQueries({ queryKey: ["coop-quest-events"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "coop_quests" },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["coop-quests"] });
          const row: any = payload.new ?? payload.old;
          if (row?.id) {
            qc.invalidateQueries({ queryKey: ["coop-quest-details", row.id] });
          } else {
            qc.invalidateQueries({ queryKey: ["coop-quest-details"] });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, qc]);
}
