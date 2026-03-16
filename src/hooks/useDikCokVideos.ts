import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { calculateTrendingScore, type ViralityFactors } from "@/utils/dikCokVirality";
import { differenceInHours } from "date-fns";
import { calculateDikCokOutcome } from "@/utils/dikcokMetrics";

export const useDikCokVideos = (bandId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: videos, isLoading } = useQuery({
    queryKey: ["dikcok-videos", bandId],
    queryFn: async () => {
      let query = supabase
        .from("dikcok_videos")
        .select(`
          *,
          band:bands(id, name, genre, logo_url, fame),
          video_type:dikcok_video_types(name, category, difficulty),
          track:songs(id, title)
        `)
        .order("created_at", { ascending: false });

      if (bandId) {
        query = query.eq("band_id", bandId);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Trending with virality algorithm
  const { data: trending } = useQuery({
    queryKey: ["dikcok-trending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dikcok_videos")
        .select(`
          *,
          band:bands(id, name, genre, fame),
          video_type:dikcok_video_types(name, category)
        `)
        .order("created_at", { ascending: false })
        .limit(100); // Fetch more, rank by algorithm

      if (error) throw error;
      if (!data) return [];

      // Apply virality algorithm to rank by trending score
      const now = new Date();
      const ranked = data
        .map((video: any) => {
          const factors: ViralityFactors = {
            views: video.views || 0,
            hypeGained: video.hype_gained || 0,
            fanGain: video.fan_gain || 0,
            bandFame: video.band?.fame || 0,
            challengeBonus: !!video.trending_tag,
            videoAge: differenceInHours(now, new Date(video.created_at)),
            videoTypeCategory: video.video_type?.category || "default",
          };
          const virality = calculateTrendingScore(factors);
          return { ...video, virality };
        })
        .sort((a: any, b: any) => b.virality.trendingScore - a.virality.trendingScore)
        .slice(0, 20);

      return ranked;
    },
  });

  const createVideoMutation = useMutation({
    mutationFn: async (videoData: {
      band_id: string;
      creator_user_id: string;
      video_type_id: string;
      track_id?: string;
      release_id?: string;
      title: string;
      description?: string;
      trending_tag?: string;
      bandName?: string;
      bandGenre?: string;
      videoTypeName?: string;
      songTitle?: string;
    }) => {
      // Extract metadata before inserting (not DB columns)
      const { bandName, bandGenre, videoTypeName, songTitle, ...insertData } = videoData;

      const { data: bandMetrics, error: bandError } = await supabase
        .from("bands")
        .select("fame, total_fans, band_balance")
        .eq("id", insertData.band_id)
        .single();

      if (bandError) throw bandError;

      const outcome = calculateDikCokOutcome({
        followers: bandMetrics?.total_fans || 0,
        bandFame: bandMetrics?.fame || 0,
        hasTrendingTag: !!insertData.trending_tag,
      });

      const { data, error } = await supabase
        .from("dikcok_videos")
        .insert({
          ...insertData,
          views: outcome.views,
          hype_gained: outcome.hypeGain,
          fan_gain: outcome.fanGain,
          engagement_velocity: outcome.velocity,
        })
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from("bands")
        .update({
          total_fans: (bandMetrics?.total_fans || 0) + outcome.fanGain,
          band_balance: Number((bandMetrics?.band_balance || 0) + outcome.revenue),
        })
        .eq("id", insertData.band_id);

      // If linked to a release, boost its hype_score
      if (insertData.release_id) {
        try {
          const { data: rel } = await supabase
            .from("releases")
            .select("hype_score")
            .eq("id", insertData.release_id)
            .single();
          if (rel) {
            const hypeBoost = Math.floor(10 + Math.random() * 16); // +10 to +25
            await supabase
              .from("releases")
              .update({ hype_score: ((rel as any).hype_score || 0) + hypeBoost } as any)
              .eq("id", insertData.release_id);
          }
        } catch (e) {
          console.warn("DikCok release hype boost failed:", e);
        }
      }

      // Fire-and-forget thumbnail generation
      supabase.functions.invoke("generate-dikcok-thumbnail", {
        body: {
          videoId: data.id,
          title: data.title,
          description: data.description || undefined,
          bandName,
          bandGenre,
          videoType: videoTypeName,
          songTitle,
        },
      }).then((result) => {
        if (result.error) {
          console.warn("Thumbnail generation failed:", result.error);
        } else {
          console.log("Thumbnail generated:", result.data);
          queryClient.invalidateQueries({ queryKey: ["dikcok-videos"] });
          queryClient.invalidateQueries({ queryKey: ["dikcok-trending"] });
        }
      });

      return { ...data, revenue_generated: outcome.revenue } as typeof data & { revenue_generated: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["dikcok-videos"] });
      queryClient.invalidateQueries({ queryKey: ["dikcok-trending"] });
      toast({
        title: "Video created! 🎬",
        description: `Your DikCok video is live (+$${((data as any).revenue_generated || 0).toFixed(2)} revenue). AI thumbnail generating...`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create video",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const incrementViewsMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const { error } = await supabase.rpc("increment_dikcok_video_views", {
        p_video_id: videoId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dikcok-videos"] });
    },
  });

  return {
    videos,
    trending,
    isLoading,
    createVideo: createVideoMutation.mutate,
    isCreating: createVideoMutation.isPending,
    incrementViews: incrementViewsMutation.mutate,
  };
};
