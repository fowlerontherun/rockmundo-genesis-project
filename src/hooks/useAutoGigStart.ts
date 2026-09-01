import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Periodically asks the server-side auto-start job to advance eligible gigs.
 * The underlying RPC is service-role only, so browser clients must invoke the
 * edge function rather than calling auto_start_scheduled_gigs directly.
 */
export const useAutoGigStart = () => {
  useEffect(() => {
    let disposed = false;

    const checkGigs = async () => {
      if (disposed) return;

      try {
        const { error } = await supabase.functions.invoke('auto-start-gigs', {
          body: { triggeredBy: 'gig-page' },
        });

        if (error) {
          console.warn('Unable to run auto-start gig check:', error);
        }
      } catch (error) {
        console.warn('Unable to run auto-start gig check:', error);
      }
    };

    // Do not compete with the page's initial band/gig reads on mount.
    const initialTimeout = window.setTimeout(() => {
      void checkGigs();
    }, 5000);

    const interval = window.setInterval(() => {
      void checkGigs();
    }, 60000);

    return () => {
      disposed = true;
      window.clearTimeout(initialTimeout);
      window.clearInterval(interval);
    };
  }, []);
};
