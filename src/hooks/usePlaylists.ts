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

  // Auto-process a submission (simulate curator review)
  const processSubmission = async (submissionId: string, playlistId: string, releaseId: string) => {
    // Get the song's quality score
    const { data: releaseData } = await supabase
      .from("song_releases")
      .select("song_id, songs(quality_score, genre)")
      .eq("id", releaseId)
      .maybeSingle();

    const qualityScore = (releaseData?.songs as any)?.quality_score || 50;

    // Get playlist acceptance criteria
    const playlist = playlists.find(p => p.id === playlistId);
    const minQuality = playlist?.acceptance_criteria?.min_quality || 40;
    
    // Calculate acceptance probability:
    // Higher quality song relative to min = higher chance
    // Bigger playlists are harder to get into
    const qualityFactor = Math.min(1, qualityScore / Math.max(minQuality, 1));
    const sizePenalty = playlist ? Math.max(0.3, 1 - (playlist.follower_count / 5000000)) : 0.5;
    const acceptChance = Math.min(0.85, qualityFactor * sizePenalty * 0.8 + 0.15);
    
    // Random delay to simulate "curator review time" (1-3 seconds)
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    const accepted = Math.random() < acceptChance;
    const status = accepted ? "accepted" : "rejected";
    
    const { error } = await supabase
      .from("playlist_submissions")
      .update({ 
        submission_status: status,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", submissionId);

    if (error) {
      console.error("Error processing submission:", error);
      return;
    }

    // If accepted, boost the release streams
    if (accepted && playlist) {
      const boostStreams = Math.floor(playlist.follower_count * 0.01 * (playlist.boost_multiplier || 1));
      const boostRevenue = Number((boostStreams * 0.004).toFixed(2));
      
      await supabase
        .from("song_releases")
        .update({
          total_streams: (releaseData as any)?.total_streams || 0 + boostStreams,
          total_revenue: (releaseData as any)?.total_revenue || 0 + boostRevenue,
        })
        .eq("id", releaseId);
    }

    // Refresh submissions
    queryClient.invalidateQueries({ queryKey: ["playlist-submissions", userId] });

    toast({
      title: accepted ? "🎉 Playlist Accepted!" : "Playlist Rejected",
      description: accepted 
        ? `Your song was added to "${playlist?.playlist_name}"! Expect a stream boost.`
        : `"${playlist?.playlist_name}" didn't accept this submission. Try another playlist or improve your song quality.`,
      variant: accepted ? "default" : "destructive",
    });
  };

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
      const { data: submission, error: insertError } = await supabase
        .from("playlist_submissions")
        .insert({
          playlist_id: playlistId,
          release_id: releaseId,
          user_id: userId,
          submission_status: "pending",
        })
        .select("id")
        .single();

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

      return { playlistId, releaseId, submissionId: submission.id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["playlist-submissions", userId] });
      queryClient.invalidateQueries({ queryKey: ["game-profile"] });
      const playlist = playlists.find(p => p.id === data.playlistId);
      toast({
        title: "Submission Sent! 📨",
        description: `Your song was submitted to "${playlist?.playlist_name}". The curator is reviewing it...`,
      });

      // Auto-process the submission after a short delay (simulates curator review)
      processSubmission(data.submissionId, data.playlistId, data.releaseId);
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Also process any existing pending submissions on load
  const processPendingSubmissions = useMutation({
    mutationFn: async () => {
      const pendingSubmissions = userSubmissions.filter(s => s.submission_status === "pending");
      for (const sub of pendingSubmissions) {
        await processSubmission(sub.id, sub.playlist_id, sub.release_id);
      }
    },
  });

  return {
    playlists,
    userSubmissions,
    isLoadingPlaylists,
    isLoadingSubmissions,
    submitToPlaylist: submitToPlaylist.mutate,
    isSubmitting: submitToPlaylist.isPending,
    processPending: processPendingSubmissions.mutate,
    isProcessingPending: processPendingSubmissions.isPending,
  };
};
