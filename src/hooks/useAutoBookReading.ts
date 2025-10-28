import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { useQueryClient } from "@tanstack/react-query";

export const useAutoBookReading = (userId: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const checkReadingSessions = async () => {
      try {
        // Trigger book reading attendance edge function
        await supabase.functions.invoke('book-reading-attendance');
        
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
