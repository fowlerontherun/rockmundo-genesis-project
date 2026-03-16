import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";

export function useTrackSongPlay() {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  const trackPlayMutation = useMutation({
    mutationFn: async ({ songId, source = "app" }: { songId: string; source?: string }) => {
      if (!profileId) {
        throw new Error("Must be logged in to track plays");
      }

      const { error } = await supabase
        .from("song_plays")
        .upsert(
          {
            song_id: songId,
            user_id: profileId,
            source,
            played_at: new Date().toISOString(),
          },
          {
            onConflict: "song_id,user_id",
            ignoreDuplicates: true,
          }
        );

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["top-played-songs"] });
      queryClient.invalidateQueries({ queryKey: ["news-top-tracks"] });
    },
    onError: (error) => {
      console.error("Failed to track song play:", error);
    },
  });

  return {
    trackPlay: (songId: string, source?: string) => 
      trackPlayMutation.mutate({ songId, source }),
    isTracking: trackPlayMutation.isPending,
  };
}