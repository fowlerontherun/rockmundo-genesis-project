import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Poll as well as subscribing: older tables may not be in the realtime publication. */
export function useSocialUpdates(profileId: string | null | undefined, table: "friendships" | "social_invites") {
  const qc = useQueryClient();
  useEffect(() => {
    if (!profileId) return;
    const refresh = () => {
      const keys = table === "friendships"
        ? ["friendships", "friend-request-counts", "player-connection", "friend-suggestions"]
        : ["social-invites-in", "social-invites-out"];
      keys.forEach((key) => void qc.invalidateQueries({ queryKey: [key, profileId] }));
    };
    const channel = supabase.channel(`social-${table}-${profileId}-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, refresh)
      .subscribe((status) => { if (status === "SUBSCRIBED") refresh(); });
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 15000);
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
      void supabase.removeChannel(channel);
    };
  }, [profileId, table, qc]);
}