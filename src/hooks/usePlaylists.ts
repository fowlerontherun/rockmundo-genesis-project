import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Playlist {
  id: string;
  platform_id: string;
  playlist_name: string;
  curator_type: string;
  follower_count: number;
  submission_cost: number | null;
  acceptance_criteria: Record<string, any>;
  boost_multiplier: number;
  created_at: string;
  platform?: {
    platform_name: string;
  };
}

export interface PlaylistSubmission {
  id: string;
  playlist_id: string;
  release_id: string;
  user_id: string;
  submission_status: 'pending' | 'accepted' | 'rejected';
  submitted_at: string;
  reviewed_at?: string | null;
  playlist?: Playlist;
}

export const usePlaylists = (userId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch real playlists from database
  const { data: playlists = [], isLoading: isLoadingPlaylists } = useQuery({
    queryKey: ["streaming-playlists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlists")
        .select(`
          *,
          platform:streaming_platforms(platform_name)
        `)
        .order("follower_count", { ascending: false });
      
      if (error) {
        console.error("Error fetching playlists:", error);
        throw error;
      }
      
      return (data || []) as Playlist[];
    },
    staleTime: 300_000,
  });

  // Fetch user's playlist submissions
  const { data: userSubmissions = [], isLoading: isLoadingSubmissions } = useQuery({
    queryKey: ["playlist-submissions", userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from("playlist_submissions")
        .select(`
          *,
          playlist:playlists(*)
        `)
        .eq("user_id", userId)
        .order("submitted_at", { ascending: false });
      
      if (error) {
        console.error("Error fetching submissions:", error);
        return [];
      }
      
      return (data || []) as PlaylistSubmission[];
    },
    enabled: !!userId,
  });

  // Submit song to playlist - requires a song_release ID
  const submitToPlaylist = useMutation({
    mutationFn: async ({ playlistId, releaseId }: { playlistId: string; releaseId: string }) => {
      if (!userId) throw new Error("User not authenticated");

      // Get playlist details for cost
      const playlist = playlists.find(p => p.id === playlistId);
      if (!playlist) throw new Error("Playlist not found");

      const submissionCost = playlist.submission_cost || 0;

      // Check user has sufficient funds
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("cash")
        .eq("user_id", userId)
        .single();

      if (profileError) throw new Error("Could not fetch profile");
      if ((profile?.cash || 0) < submissionCost) {
        throw new Error(`Insufficient funds. Need $${(submissionCost / 100).toFixed(2)}`);
      }

      // Check if already submitted
      const { data: existing } = await supabase
        .from("playlist_submissions")
        .select("id")
        .eq("playlist_id", playlistId)
        .eq("release_id", releaseId)
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        throw new Error("You have already submitted to this playlist");
      }

      // Deduct submission cost
      if (submissionCost > 0) {
        const { error: cashError } = await supabase
          .from("profiles")
          .update({ cash: (profile?.cash || 0) - submissionCost })
          .eq("user_id", userId);

        if (cashError) throw cashError;
      }

      // Insert submission record
      const { error: insertError } = await supabase
        .from("playlist_submissions")
        .insert({
          playlist_id: playlistId,
          release_id: releaseId,
          user_id: userId,
          submission_status: "pending",
        });

      if (insertError) {
        // Refund on failure
        if (submissionCost > 0) {
          await supabase
            .from("profiles")
            .update({ cash: (profile?.cash || 0) })
            .eq("user_id", userId);
        }
        throw insertError;
      }

      // Log the activity
      await supabase.from("activity_feed").insert({
        user_id: userId,
        activity_type: "playlist_submission",
        message: `Submitted song to "${playlist.playlist_name}" playlist`,
        metadata: {
          playlist_id: playlistId,
          release_id: releaseId,
          cost: submissionCost,
        },
      });

      return { playlistId, releaseId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["playlist-submissions", userId] });
      queryClient.invalidateQueries({ queryKey: ["game-profile"] });
      const playlist = playlists.find(p => p.id === variables.playlistId);
      toast({
        title: "Submission Successful",
        description: `Your song has been submitted to "${playlist?.playlist_name}". You'll be notified of the curator's decision.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    playlists,
    userSubmissions,
    isLoadingPlaylists,
    isLoadingSubmissions,
    submitToPlaylist: submitToPlaylist.mutate,
    isSubmitting: submitToPlaylist.isPending,
  };
};
