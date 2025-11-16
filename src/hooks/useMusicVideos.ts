import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MusicVideo {
  id: string;
  song_id: string;
  band_id: string | null;
  video_title: string;
  video_url: string | null;
  thumbnail_url: string | null;
  production_cost: number;
  views_count: number;
  likes_count: number;
  chart_peak_position: number | null;
  weeks_on_chart: number;
  release_date: string | null;
  is_trending: boolean;
  created_at: string;
  song?: any;
  band?: any;
}

export const useMusicVideos = (userId?: string) => {
  const queryClient = useQueryClient();

  // Fetch all videos
  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["music-videos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("music_videos")
        .select(`
          *,
          song:songs(title, genre, mood),
          band:bands(name)
        `)
        .order("views_count", { ascending: false });

      if (error) throw error;
      return data as MusicVideo[];
    },
  });

  // Fetch user's videos
  const { data: myVideos = [] } = useQuery({
    queryKey: ["my-music-videos", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await (supabase as any)
        .from("music_videos")
        .select(`
          *,
          song:songs(title, genre, mood),
          band:bands(name)
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as MusicVideo[];
    },
    enabled: !!userId,
  });

  // Fetch trending videos
  const { data: trendingVideos = [] } = useQuery({
    queryKey: ["trending-music-videos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("music_videos")
        .select(`
          *,
          song:songs(title, genre, mood),
          band:bands(name)
        `)
        .eq("is_trending", true)
        .order("views_count", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as MusicVideo[];
    },
  });

  // Log video play
  const logPlay = useMutation({
    mutationFn: async ({ videoId, watchDuration }: { videoId: string; watchDuration: number }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error: playError } = await (supabase as any).from("music_video_plays").insert({
        video_id: videoId,
        user_id: user?.id || null,
        watch_duration_seconds: watchDuration,
        completed: watchDuration > 60,
      });

      if (playError) throw playError;

      // Manual increment
      const { data: video } = await (supabase as any)
        .from("music_videos")
        .select("views_count")
        .eq("id", videoId)
        .single();

      if (video) {
        await (supabase as any)
          .from("music_videos")
          .update({ views_count: (video as any).views_count + 1 })
          .eq("id", videoId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["music-videos"] });
    },
  });

  return {
    videos,
    myVideos,
    trendingVideos,
    isLoading,
    logPlay: logPlay.mutate,
  };
};
