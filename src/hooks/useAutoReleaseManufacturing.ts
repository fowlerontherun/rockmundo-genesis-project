import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveProfile } from "./useActiveProfile";

export const useAutoReleaseManufacturing = (userId: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profileId } = useActiveProfile();

  useEffect(() => {
    if (!userId || !profileId) return;

    const checkManufacturing = async () => {
      try {
        const bandIds = await getBandIds(profileId);

        // Get releases that should be completing manufacturing
        const { data: readyReleases, error } = await supabase
          .from('releases')
          .select('id, title, manufacturing_complete_at, scheduled_release_date')
          .eq('release_status', 'manufacturing')
          .not('manufacturing_complete_at', 'is', null)
          .lte('manufacturing_complete_at', new Date().toISOString())
          .or(`user_id.eq.${userId},band_id.in.(${bandIds})`);

        if (error) throw error;

        if (readyReleases && readyReleases.length > 0) {
          // Check if scheduled date is reached (or no scheduled date)
          const releasesToComplete = readyReleases.filter(r => 
            !r.scheduled_release_date || new Date(r.scheduled_release_date) <= new Date()
          );

          if (releasesToComplete.length > 0) {
            // Trigger edge function to complete them
            await supabase.functions.invoke('complete-release-manufacturing');

            queryClient.invalidateQueries({ queryKey: ["releases"] });

            toast({
              title: "Release Ready!",
              description: `${releasesToComplete.length} release(s) have completed manufacturing and are now available!`,
            });
          }
        }
      } catch (error) {
        console.error('Error checking manufacturing:', error);
      }
    };

    async function getBandIds(profileId: string) {
      const { data } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("profile_id", profileId)
        .eq("member_status", "active");
      return data?.map(d => d.band_id).join(",") || "null";
    }

    // Check on mount
    checkManufacturing();

    // Check every 10 minutes
    const interval = setInterval(checkManufacturing, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [userId, profileId, toast, queryClient]);
};
