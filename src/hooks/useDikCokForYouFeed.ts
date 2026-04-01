import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { calculateTrendingScore, type ViralityFactors } from "@/utils/dikCokVirality";
import { differenceInHours } from "date-fns";

/**
 * "For You" feed algorithm — personalized based on:
 * 1. User's band genre preferences
 * 2. Videos from bands with similar fame levels
 * 3. Trending videos they haven't seen
 * 4. Fresh content boost
 */
export const useDikCokForYouFeed = (userBandGenres: string[] = [], userFame: number = 0) => {
  const { profileId } = useActiveProfile();

  const { data: forYouVideos = [], isLoading } = useQuery({
    queryKey: ["dikcok-foryou", profileId, userBandGenres.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dikcok_videos")
        .select(`
          *,
          band:bands(id, name, genre, fame, logo_url),
          video_type:dikcok_video_types(name, category)
        `)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      if (!data) return [];

      const now = new Date();

      const scored = data.map((video: any) => {
        const factors: ViralityFactors = {
          views: video.views || 0,
          hypeGained: video.hype_gained || 0,
          fanGain: video.fan_gain || 0,
          bandFame: video.band?.fame || 0,
          ageInHours: differenceInHours(now, new Date(video.created_at)),
          videoCategory: video.video_type?.category || "",
        };

        let score = calculateTrendingScore(factors);

        // Genre affinity boost: +30% if matches user's band genres
        const videoGenre = video.band?.genre?.toLowerCase() || "";
        if (userBandGenres.some(g => videoGenre.includes(g.toLowerCase()))) {
          score *= 1.3;
        }

        // Fame proximity boost: videos from bands at similar fame level get +20%
        const fameDiff = Math.abs((video.band?.fame || 0) - userFame);
        if (fameDiff < 500) score *= 1.2;
        else if (fameDiff < 2000) score *= 1.1;

        // Freshness boost: <6h old gets +50%
        const ageHours = differenceInHours(now, new Date(video.created_at));
        if (ageHours < 6) score *= 1.5;
        else if (ageHours < 24) score *= 1.2;

        // Exclude own band's videos
        const isOwn = video.band_id === profileId;

        return { ...video, forYouScore: score, isOwn };
      });

      return scored
        .filter((v: any) => !v.isOwn)
        .sort((a: any, b: any) => b.forYouScore - a.forYouScore)
        .slice(0, 30);
    },
    enabled: !!profileId,
  });

  return { forYouVideos, isLoading };
};
