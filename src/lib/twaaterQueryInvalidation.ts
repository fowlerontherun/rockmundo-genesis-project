import type { QueryClient } from "@tanstack/react-query";

const TWAATER_CONTENT_QUERY_KEYS = [
  "twaats",
  "twaater-feed",
  "twaater-ai-feed",
  "twaater-explore-feed",
  "twaater-trending",
  "twaater-trending-hashtags",
  "trending-twaats",
  "hashtag-feed",
  "twaat-detail",
  "twaater-profile-twaats",
  "twaater-profile-likes",
  "twaater-mentions",
  "twaater-bookmarks",
] as const;

export const invalidateTwaaterContentQueries = (queryClient: QueryClient) => {
  for (const key of TWAATER_CONTENT_QUERY_KEYS) {
    void queryClient.invalidateQueries({ queryKey: [key] });
  }
};
