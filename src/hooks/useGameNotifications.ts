import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { useQueryClient } from "@tanstack/react-query";

export const useGameNotifications = (userId: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const checkNotifications = async () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      try {
        // Get user's band IDs first
        const bandIds = await getUserBandIds(userId);
        
        // Check for upcoming gigs (within 24 hours)
        const { data: upcomingGigs } = await supabase
          .from('gigs')
          .select('id, scheduled_date, venues!gigs_venue_id_fkey(name)')
          .eq('status', 'scheduled')
          .gte('scheduled_date', now.toISOString())
          .lte('scheduled_date', tomorrow.toISOString())
          .in('band_id', bandIds);

        if (upcomingGigs && upcomingGigs.length > 0) {
          upcomingGigs.forEach(gig => {
            const gigTime = new Date(gig.scheduled_date);
            const hoursUntil = Math.round((gigTime.getTime() - now.getTime()) / (1000 * 60 * 60));
            
            if (hoursUntil <= 24 && hoursUntil > 0) {
              toast({
                title: "Upcoming Gig!",
                description: `You have a gig at ${gig.venues?.name} in ${hoursUntil} hours. Make sure you're prepared!`,
              });
            }
          });
        }

        // Check for releases completing manufacturing
        const bandIdsStr = bandIds.join(',') || 'null';
        const { data: completingReleases } = await supabase
          .from('releases')
          .select('id, title, manufacturing_complete_at')
          .eq('release_status', 'manufacturing')
          .not('manufacturing_complete_at', 'is', null)
          .lte('manufacturing_complete_at', tomorrow.toISOString())
          .gte('manufacturing_complete_at', now.toISOString())
          .or(`user_id.eq.${userId},band_id.in.(${bandIdsStr})`);

        if (completingReleases && completingReleases.length > 0) {
          completingReleases.forEach(release => {
            const completeTime = new Date(release.manufacturing_complete_at);
            const hoursUntil = Math.round((completeTime.getTime() - now.getTime()) / (1000 * 60 * 60));
            
            if (hoursUntil <= 24 && hoursUntil >= 0) {
              toast({
                title: "Release Ready Soon!",
                description: `"${release.title}" will complete manufacturing in ${hoursUntil} hours.`,
              });
            }
          });
        }

        // Check for scheduled releases
        const today = now.toISOString().split('T')[0];
        const { data: releasingToday } = await supabase
          .from('releases')
          .select('id, title')
          .eq('release_status', 'released')
          .eq('scheduled_release_date', today)
          .or(`user_id.eq.${userId},band_id.in.(${bandIdsStr})`);

        if (releasingToday && releasingToday.length > 0) {
          releasingToday.forEach(release => {
            toast({
              title: "Release Day! 🎉",
              description: `"${release.title}" is now available to the public!`,
            });
          });
        }

      } catch (error) {
        console.error('Error checking notifications:', error);
      }
    };

    async function getUserBandIds(userId: string): Promise<string[]> {
      const { data } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", userId);
      return data?.map(d => d.band_id) || [];
    }

    // Check on mount
    checkNotifications();

    // Check every 30 minutes
    const interval = setInterval(checkNotifications, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [userId, toast, queryClient]);
};
