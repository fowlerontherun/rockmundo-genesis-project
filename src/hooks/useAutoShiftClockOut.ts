import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

// Shift completion is exclusively performed by a privileged 15-minute cron.
// Browser polling refreshes the status but MUST NOT invoke the global
// shift-clock-out worker (issue #4215).
export const useAutoShiftClockOut = (userId: string | null) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const refreshShifts = () => {
      void queryClient.invalidateQueries({ queryKey: ["jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["profiles"] });
    };

    refreshShifts();
    const interval = setInterval(refreshShifts, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userId, queryClient]);
};
