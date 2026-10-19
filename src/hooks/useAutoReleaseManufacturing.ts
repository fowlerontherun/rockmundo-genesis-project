import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveProfile } from "./useActiveProfile";

// The worldwide manufacturing-completion worker is cron-owned. A character's
// release screen only refreshes data, never invokes that privileged worker.
export const useAutoReleaseManufacturing = (userId: string | null) => {
  const queryClient = useQueryClient();
  const { profileId } = useActiveProfile();

  useEffect(() => {
    if (!userId || !profileId) return;
    const refreshReleases = () => {
      void queryClient.invalidateQueries({ queryKey: ["releases"] });
    };
    refreshReleases();
    const interval = window.setInterval(refreshReleases, 2 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [userId, profileId, queryClient]);
};
