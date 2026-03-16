import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';
import { useActiveProfile } from './useActiveProfile';

/**
 * Hook that listens for gig completions and shows notifications
 */
export const useGigNotifications = () => {
  const { toast } = useToast();
  const { profileId } = useActiveProfile();
  const notifiedGigs = useRef(new Set<string>());

  useEffect(() => {
    if (!profileId) return;

    const checkCompletedGigs = async () => {
      // Get user's bands via profile_id
      const { data: bandMemberships } = await supabase
        .from('band_members')
        .select('band_id')
        .eq('profile_id', profileId)
        .eq('member_status', 'active');

      if (!bandMemberships || bandMemberships.length === 0) return;

      const bandIds = bandMemberships.map(m => m.band_id);

      // Check for recently completed gigs
      const { data: completedGigs } = await supabase
        .from('gigs')
        .select('id, status, band_id, gig_outcomes(*)')
        .in('band_id', bandIds)
        .eq('status', 'completed')
        .gte('completed_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // Last 5 minutes

      if (completedGigs) {
        for (const gig of completedGigs) {
          if (!notifiedGigs.current.has(gig.id) && gig.gig_outcomes && gig.gig_outcomes.length > 0) {
            const outcome = gig.gig_outcomes[0];
            notifiedGigs.current.add(gig.id);
            
            toast({
              title: '🎸 Gig Completed!',
              description: `Rating: ${outcome.overall_rating?.toFixed(1)}/25 • Profit: $${outcome.net_profit?.toLocaleString()} • Fame: +${outcome.fame_gained}`,
              duration: 8000,
            });
          }
        }
      }
    };

    // Check immediately
    checkCompletedGigs();

    // Then check every 30 seconds
    const interval = setInterval(checkCompletedGigs, 30000);

    // Subscribe to gig updates
    const channel = supabase
      .channel('gig-completions')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'gigs',
          filter: `status=eq.completed`
        },
        () => {
          checkCompletedGigs();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [profileId, toast]);
};
