import { useQuery } from "@tanstack/react-query";
import {
  extractTrendingTopics,
  fetchRecentTwaatsForTrending,
  scoreTrendingTwaats,
} from "@/services/twaaterTrendingService";

const TWAATER_TRENDING_QUERY_KEY = ["twaater-trending"] as const;
const TWAATER_TRENDING_REFETCH_MS = 5 * 60 * 1000;

export const useTwaaterTrending = () => {
  const { data, isLoading } = useQuery({
    queryKey: TWAATER_TRENDING_QUERY_KEY,
    queryFn: async () => {
      const recentTwaats = await fetchRecentTwaatsForTrending();

      return {
        trendingTwaats: scoreTrendingTwaats(recentTwaats),
        trendingTopics: extractTrendingTopics(recentTwaats),
      };
    },
    refetchInterval: TWAATER_TRENDING_REFETCH_MS,
  });

  return {
    trendingTwaats: data?.trendingTwaats ?? [],
    trendingTopics: data?.trendingTopics ?? [],
    isLoading,
  };
};
