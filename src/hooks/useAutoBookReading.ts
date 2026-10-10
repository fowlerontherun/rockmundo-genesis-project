import { useEffect } from "react";
import { useToast } from "./use-toast";
import { useQueryClient } from "@tanstack/react-query";

export const useAutoBookReading = (userId: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const checkReadingSessions = async () => {
      try {
        // Only the trusted scheduler may process all players' attendance.
        // Client refreshes must never trigger the global processing endpoint.
        
        queryClient.invalidateQueries({ queryKey: ["skill-books"] });
        queryClient.invalidateQueries({ queryKey: ["player-skills"] });
      } catch (error) {
        console.error('Error checking book reading:', error);
      }
    };

    checkReadingSessions();
    const interval = setInterval(checkReadingSessions, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [userId, toast, queryClient]);
};
