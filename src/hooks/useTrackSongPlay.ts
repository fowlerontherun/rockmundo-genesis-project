import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";

export function useTrackSongPlay() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const trackPlayMutation = useMutation({
    mutationFn: async ({ songId, source = "app" }: { songId: string; source?: string }) => {
      if (!user?.id) {
        throw new Error("Must be logged in to track plays");
      }

      // Use upsert - the unique constraint will prevent duplicate plays from same user
      const { error } = await supabase
        .from("song_plays")
        .upsert(
          {
            song_id: songId,
            user_id: user.id,
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
      // Invalidate top played songs queries to update counts
      queryClient.invalidateQueries({ queryKey: ["top-played-songs"] });
      queryClient.invalidateQueries({ queryKey: ["news-top-tracks"] });
    },
    onError: (error) => {
      // Silently fail - don't interrupt user experience for tracking
      console.error("Failed to track song play:", error);
    },
  });

  return {
    trackPlay: (songId: string, source?: string) => 
      trackPlayMutation.mutate({ songId, source }),
    isTracking: trackPlayMutation.isPending,
  };
}
