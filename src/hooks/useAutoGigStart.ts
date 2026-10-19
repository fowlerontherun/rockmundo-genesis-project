import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Gig start is now exclusively owned by PostgreSQL pg_cron and the
 * service-only run_auto_start_gigs_scheduled() worker. The browser should
 * refresh cached gig state, not invoke the global economy/lifecycle job.
 */
export const useAutoGigStart = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const refreshGigs = () => {
      void queryClient.invalidateQueries({ queryKey: ['gigs'] });
      void queryClient.invalidateQueries({ queryKey: ['upcoming-gigs'] });
      void queryClient.invalidateQueries({ queryKey: ['gig'] });
    };

    // Let the initial queries load naturally, then observe cron changes.
    const initialTimeout = window.setTimeout(refreshGigs, 5000);
    const interval = window.setInterval(refreshGigs, 60000);
    return () => {
      window.clearTimeout(initialTimeout);
      window.clearInterval(interval);
    };
  }, [queryClient]);
};
