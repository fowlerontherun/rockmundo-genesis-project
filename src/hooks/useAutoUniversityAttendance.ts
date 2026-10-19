import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

// Global university XP is awarded only by the trusted hourly server worker.
// The browser may refresh its own display; it must never invoke the
// privileged university-attendance function for everyone (#4228).
export const useAutoUniversityAttendance = (profileId: string | null) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!profileId) return;

    const refreshLearning = () => {
      void queryClient.invalidateQueries({ queryKey: ["university-enrollments"] });
      void queryClient.invalidateQueries({ queryKey: ["player-skills"] });
      void queryClient.invalidateQueries({ queryKey: ["current_enrollment", profileId] });
      void queryClient.invalidateQueries({ queryKey: ["current_enrollment_full", profileId] });
    };

    refreshLearning();
    const interval = setInterval(refreshLearning, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [profileId, queryClient]);
};
