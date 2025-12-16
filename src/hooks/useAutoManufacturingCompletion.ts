import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Client-side hook to auto-complete manufacturing for releases.
 * Runs globally in Layout.tsx to ensure releases complete regardless of current page.
 */
export const useAutoManufacturingCompletion = (userId: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const lastCheckRef = useRef<number>(0);

  useEffect(() => {
    if (!userId) return;

    const checkAndCompleteManufacturing = async () => {
      const now = Date.now();
      // Prevent checks more frequent than every 30 seconds
      if (now - lastCheckRef.current < 30000) return;
      lastCheckRef.current = now;

      try {
        console.log('[AutoManufacturing] Checking for completed releases...');
        
        // Call the database function to complete manufacturing
        const { data: completedCount, error } = await supabase.rpc('auto_complete_manufacturing');

        if (error) {
          console.error('[AutoManufacturing] Error:', error);
          return;
        }

        if (completedCount && completedCount > 0) {
          console.log(`[AutoManufacturing] Completed ${completedCount} release(s)`);
          
          queryClient.invalidateQueries({ queryKey: ["releases"] });
          
          toast({
            title: "Release Complete!",
            description: `${completedCount} release(s) have finished manufacturing and are now available!`,
          });
        } else {
          console.log('[AutoManufacturing] No releases ready for completion');
        }
      } catch (error) {
        console.error('[AutoManufacturing] Error checking manufacturing:', error);
      }
    };

    // Check on mount
    checkAndCompleteManufacturing();

    // Check every 2 minutes
    const interval = setInterval(checkAndCompleteManufacturing, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [userId, toast, queryClient]);
};
