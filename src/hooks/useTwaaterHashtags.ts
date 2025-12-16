import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Extract hashtags from text
export const extractHashtags = (text: string): string[] => {
  const hashtagRegex = /#(\w+)/g;
  const matches = text.match(hashtagRegex);
  return matches ? matches.map(tag => tag.slice(1).toLowerCase()) : [];
};

// Calculate trending score based on recency and usage count
const calculateTrendingScore = (count: number, hoursSinceFirst: number): number => {
  // Decay factor - more recent hashtags get higher scores
  const decayFactor = Math.max(0.1, 1 - (hoursSinceFirst / 168)); // 168 hours = 1 week
  return count * decayFactor;
};

export interface TrendingHashtag {
  tag: string;
  count: number;
  trendingScore: number;
}

export const useTwaaterHashtags = () => {
  // Fetch trending hashtags by analyzing recent twaats
  const { data: trending, isLoading } = useQuery({
    queryKey: ["twaater-trending-hashtags"],
    queryFn: async () => {
      // Get twaats from last 7 days
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { data: twaats, error } = await supabase
        .from("twaats")
        .select("body, created_at")
        .gte("created_at", oneWeekAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      // Count hashtags with time weighting
      const hashtagMap = new Map<string, { count: number; firstSeen: Date }>();

      twaats?.forEach((twaat) => {
        const hashtags = extractHashtags(twaat.body);
        const twaatDate = new Date(twaat.created_at);

        hashtags.forEach((tag) => {
          const existing = hashtagMap.get(tag);
          if (existing) {
            existing.count++;
          } else {
            hashtagMap.set(tag, { count: 1, firstSeen: twaatDate });
          }
        });
      });

      // Calculate trending scores and sort
      const now = new Date();
      const trending: TrendingHashtag[] = Array.from(hashtagMap.entries())
        .map(([tag, data]) => {
          const hoursSinceFirst = (now.getTime() - data.firstSeen.getTime()) / (1000 * 60 * 60);
          return {
            tag,
            count: data.count,
            trendingScore: calculateTrendingScore(data.count, hoursSinceFirst),
          };
        })
        .filter(h => h.count >= 2) // Only show hashtags used at least twice
        .sort((a, b) => b.trendingScore - a.trendingScore)
        .slice(0, 10); // Top 10 trending

      return trending;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Search twaats by hashtag
  const searchByHashtag = async (hashtag: string) => {
    const { data, error } = await supabase
      .from("twaats")
      .select(`
        *,
        account:twaater_accounts!twaats_account_id_fkey(
          id, handle, display_name, avatar_url, is_verified
        )
      `)
      .ilike("body", `%#${hashtag}%`)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    return data;
  };

  return {
    trending: trending || [],
    isLoading,
    searchByHashtag,
  };
};
