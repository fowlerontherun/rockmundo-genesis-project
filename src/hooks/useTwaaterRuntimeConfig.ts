import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TwaaterRuntimeConfig = {
  maxLength: number;
  hashtagsEnabled: boolean;
  pollsEnabled: boolean;
  verifiedBadgesEnabled: boolean;
  mediaUploadsEnabled: boolean;
  likesWeight: number;
  repliesWeight: number;
  retwaatsWeight: number;
  trendingDecayHours: number;
  verifiedBonusMultiplier: number;
  xpPerRewardedPost: number;
  dailyRewardLimit: number;
};

const DEFAULT_CONFIG: TwaaterRuntimeConfig = {
  maxLength: 280,
  hashtagsEnabled: true,
  pollsEnabled: true,
  verifiedBadgesEnabled: true,
  mediaUploadsEnabled: true,
  likesWeight: 30,
  repliesWeight: 40,
  retwaatsWeight: 30,
  trendingDecayHours: 24,
  verifiedBonusMultiplier: 2,
  xpPerRewardedPost: 5,
  dailyRewardLimit: 3,
};

const KEYS = [
  "twaater_max_length",
  "twaater_hashtags_enabled",
  "twaater_polls_enabled",
  "twaater_verified_enabled",
  "twaater_media_enabled",
  "twaater_likes_weight",
  "twaater_replies_weight",
  "twaater_retwaats_weight",
  "twaater_trending_decay_hours",
  "twaater_verified_bonus",
  "twaater_xp_per_rewarded_post",
  "twaater_daily_reward_limit",
];

export const useTwaaterRuntimeConfig = () => {
  const query = useQuery({
    queryKey: ["twaater-runtime-config"],
    queryFn: async (): Promise<TwaaterRuntimeConfig> => {
      const { data, error } = await supabase
        .from("game_balance_config")
        .select("key, value")
        .in("key", KEYS);

      if (error) throw error;

      const values = new Map((data || []).map((item: any) => [item.key, Number(item.value)]));
      const numberValue = (key: string, fallback: number) => {
        const value = values.get(key);
        return Number.isFinite(value) ? Number(value) : fallback;
      };
      const boolValue = (key: string, fallback: boolean) => {
        const value = values.get(key);
        return value === undefined ? fallback : Number(value) !== 0;
      };

      return {
        maxLength: Math.max(1, Math.round(numberValue("twaater_max_length", DEFAULT_CONFIG.maxLength))),
        hashtagsEnabled: boolValue("twaater_hashtags_enabled", DEFAULT_CONFIG.hashtagsEnabled),
        pollsEnabled: boolValue("twaater_polls_enabled", DEFAULT_CONFIG.pollsEnabled),
        verifiedBadgesEnabled: boolValue("twaater_verified_enabled", DEFAULT_CONFIG.verifiedBadgesEnabled),
        mediaUploadsEnabled: boolValue("twaater_media_enabled", DEFAULT_CONFIG.mediaUploadsEnabled),
        likesWeight: Math.max(0, numberValue("twaater_likes_weight", DEFAULT_CONFIG.likesWeight)),
        repliesWeight: Math.max(0, numberValue("twaater_replies_weight", DEFAULT_CONFIG.repliesWeight)),
        retwaatsWeight: Math.max(0, numberValue("twaater_retwaats_weight", DEFAULT_CONFIG.retwaatsWeight)),
        trendingDecayHours: Math.max(1, numberValue("twaater_trending_decay_hours", DEFAULT_CONFIG.trendingDecayHours)),
        verifiedBonusMultiplier: Math.max(1, numberValue("twaater_verified_bonus", DEFAULT_CONFIG.verifiedBonusMultiplier)),
        xpPerRewardedPost: Math.max(0, Math.round(numberValue("twaater_xp_per_rewarded_post", DEFAULT_CONFIG.xpPerRewardedPost))),
        dailyRewardLimit: Math.max(1, Math.round(numberValue("twaater_daily_reward_limit", DEFAULT_CONFIG.dailyRewardLimit))),
      };
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    config: query.data || DEFAULT_CONFIG,
    isLoading: query.isLoading,
    error: query.error,
  };
};
