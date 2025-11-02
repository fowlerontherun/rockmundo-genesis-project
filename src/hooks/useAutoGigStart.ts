import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook that periodically checks for gigs that should auto-start
 * Runs every minute when the component is mounted
 */
export const useAutoGigStart = () => {
  useEffect(() => {
    const checkGigs = async () => {
      try {
        // Call the database function to auto-start eligible gigs
        const { error } = await supabase.rpc('auto_start_scheduled_gigs');
        
        if (error) {
          console.error('Error auto-starting gigs:', error);
        }
      } catch (error) {
        console.error('Error in auto-start check:', error);
      }
    };

    // Check immediately on mount
    checkGigs();

    // Then check every minute
    const interval = setInterval(checkGigs, 60000);

    return () => clearInterval(interval);
  }, []);
};
