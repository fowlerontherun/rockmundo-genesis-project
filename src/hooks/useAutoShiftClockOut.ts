import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { useQueryClient } from "@tanstack/react-query";

export const useAutoShiftClockOut = (userId: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const checkShifts = async () => {
      try {
        // Trigger shift clock-out edge function
        await supabase.functions.invoke('shift-clock-out');
        
        queryClient.invalidateQueries({ queryKey: ["jobs"] });
        queryClient.invalidateQueries({ queryKey: ["profiles"] });
      } catch (error) {
        console.error('Error checking shifts:', error);
      }
    };

    checkShifts();
    const interval = setInterval(checkShifts, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [userId, toast, queryClient]);
};
