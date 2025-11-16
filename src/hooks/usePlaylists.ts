import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Playlist {
  id: string;
  name: string;
  curator: string;
  genre: string;
  follower_count: number;
  submission_fee: number;
  acceptance_rate: number;
  created_at: string;
}

export interface PlaylistSubmission {
  id: string;
  playlist_id: string;
  song_id: string;
  user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  submitted_at: string;
  reviewed_at?: string | null;
  playlist?: Playlist;
  song?: {
    id: string;
    title: string;
    genre: string;
  };
}

export const usePlaylists = (userId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: playlists = [], isLoading: isLoadingPlaylists } = useQuery({
    queryKey: ["streaming-playlists"],
    queryFn: async () => {
      // Since there's no playlists table yet, return mock data
      return [
        { id: "1", name: "Indie Discoveries", curator: "Spotify", genre: "Indie", follower_count: 150000, submission_fee: 50, acceptance_rate: 15 },
        { id: "2", name: "Rock Rising", curator: "Apple Music", genre: "Rock", follower_count: 85000, submission_fee: 40, acceptance_rate: 20 },
        { id: "3", name: "Electronic Essentials", curator: "SoundCloud", genre: "Electronic", follower_count: 200000, submission_fee: 60, acceptance_rate: 12 },
        { id: "4", name: "Pop Radar", curator: "Tidal", genre: "Pop", follower_count: 300000, submission_fee: 75, acceptance_rate: 10 },
        { id: "5", name: "Hip Hop Heat", curator: "YouTube Music", genre: "Hip-Hop", follower_count: 120000, submission_fee: 45, acceptance_rate: 18 },
      ] as Playlist[];
    },
    staleTime: 300_000,
  });

  const { data: userSubmissions = [], isLoading: isLoadingSubmissions } = useQuery({
    queryKey: ["playlist-submissions", userId],
    queryFn: async () => {
      if (!userId) return [];
      
      // Mock data for now - would query playlist_submissions table
      return [] as PlaylistSubmission[];
    },
    enabled: !!userId,
  });

  const submitToPlaylist = useMutation({
    mutationFn: async ({ playlistId, songId }: { playlistId: string; songId: string }) => {
      if (!userId) throw new Error("User not authenticated");

      // Would insert into playlist_submissions table
      // For now, just simulate the submission
      const playlist = playlists.find(p => p.id === playlistId);
      if (!playlist) throw new Error("Playlist not found");

      // Deduct submission fee from user cash
      const { data: profile } = await supabase
        .from("profiles")
        .select("cash")
        .eq("user_id", userId)
        .single();

      if (!profile || (profile.cash || 0) < playlist.submission_fee) {
        throw new Error("Insufficient funds for submission fee");
      }

      await supabase
        .from("profiles")
        .update({ cash: (profile.cash || 0) - playlist.submission_fee })
        .eq("user_id", userId);

      return { playlistId, songId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["playlist-submissions", userId] });
      const playlist = playlists.find(p => p.id === variables.playlistId);
      toast({
        title: "Submission Successful",
        description: `Your song has been submitted to "${playlist?.name}". You'll be notified of the curator's decision.`,
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
