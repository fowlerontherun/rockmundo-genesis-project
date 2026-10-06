import { useQuery } from "@tanstack/react-query";
import {
  extractTrendingTopics,
  fetchRecentTwaatsForTrending,
  scoreTrendingTwaats,
} from "@/services/twaaterTrendingService";
import { hydrateTwaaterFeedExtras } from "@/hooks/useTwaats";

const TWAATER_TRENDING_QUERY_KEY = ["twaater-trending"] as const;
const TWAATER_TRENDING_REFETCH_MS = 5 * 60 * 1000;

export const useTwaaterTrending = () => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: TWAATER_TRENDING_QUERY_KEY,
    queryFn: async () => {
      const recentTwaats = await fetchRecentTwaatsForTrending();
      const hydratedTwaats = await hydrateTwaaterFeedExtras(recentTwaats as any[]);

      return {
        trendingTwaats: scoreTrendingTwaats(hydratedTwaats as any[]),
        trendingTopics: extractTrendingTopics(recentTwaats),
      };
    },
    refetchInterval: TWAATER_TRENDING_REFETCH_MS,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    trendingTwaats: data?.trendingTwaats ?? [],
    trendingTopics: data?.trendingTopics ?? [],
    isLoading,
    error,
    refetch,
  };
};
