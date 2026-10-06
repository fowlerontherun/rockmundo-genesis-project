import { useQuery } from "@tanstack/react-query";
import {
  extractTrendingTopics,
  fetchRecentTwaatsForTrending,
  scoreTrendingTwaats,
} from "@/services/twaaterTrendingService";
import { useTwaaterRuntimeConfig } from "@/hooks/useTwaaterRuntimeConfig";
import { hydrateTwaaterFeedExtras } from "@/hooks/useTwaats";

const TWAATER_TRENDING_QUERY_KEY = ["twaater-trending"] as const;
const TWAATER_TRENDING_REFETCH_MS = 5 * 60 * 1000;

export const useTwaaterTrending = () => {
  const { config } = useTwaaterRuntimeConfig();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: TWAATER_TRENDING_QUERY_KEY,
    queryFn: async () => {
      const recentTwaats = await fetchRecentTwaatsForTrending();
      const hydratedTwaats = await hydrateTwaaterFeedExtras(recentTwaats as any[]);

      return {
        recentTwaats,
        hydratedTwaats,
      };
    },
    refetchInterval: TWAATER_TRENDING_REFETCH_MS,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    trendingTwaats: scoreTrendingTwaats((data?.hydratedTwaats || []) as any[], {
      likesWeight: config.likesWeight,
      repliesWeight: config.repliesWeight,
      retwaatsWeight: config.retwaatsWeight,
      decayHours: config.trendingDecayHours,
      verifiedBoost: config.verifiedBonusMultiplier,
    }),
    trendingTopics: config.hashtagsEnabled ? extractTrendingTopics(data?.recentTwaats || []) : [],
    isLoading,
    error,
    refetch,
  };
};
