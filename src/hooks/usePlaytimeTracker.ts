import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to track player's total hours played.
 * Updates the profile's total_hours_played every 5 minutes while the user is active.
 */
export const usePlaytimeTracker = (userId: string | null) => {
  const lastUpdateRef = useRef<number>(Date.now());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!userId) return;

    const UPDATE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

    const updatePlaytime = async () => {
      const now = Date.now();
      const elapsedMinutes = Math.floor((now - lastUpdateRef.current) / (60 * 1000));
      
      if (elapsedMinutes < 5) return; // Don't update more frequently than every 5 minutes

      try {
        // First, get the current total_hours_played
        const { data: profile, error: fetchError } = await supabase
          .from('profiles')
          .select('total_hours_played')
          .eq('user_id', userId)
          .single();

        if (fetchError) {
          console.warn('Failed to fetch profile for playtime update:', fetchError.message);
          return;
        }

        const currentHours = (profile?.total_hours_played || 0);
        const hoursToAdd = elapsedMinutes / 60;

        // Update with new total
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            total_hours_played: Math.round((currentHours + hoursToAdd) * 100) / 100,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (updateError) {
          console.warn('Failed to update playtime:', updateError.message);
        } else {
          lastUpdateRef.current = now;
        }
      } catch (err) {
        console.warn('Playtime tracker error:', err);
      }
    };

    // Set up interval
    intervalRef.current = setInterval(updatePlaytime, UPDATE_INTERVAL_MS);

    // Also update on visibility change (when user returns to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updatePlaytime();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Update on unmount (user leaving)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // Final update on unmount
      updatePlaytime();
    };
  }, [userId]);
};
