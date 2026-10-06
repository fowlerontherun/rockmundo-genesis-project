import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TwaaterRuntimeConfig = {
  maxLength: number;
  hashtagsEnabled: boolean;
  pollsEnabled: boolean;
  mediaEnabled: boolean;
  verifiedBadgesEnabled: boolean;
};

const DEFAULTS: TwaaterRuntimeConfig = {
  maxLength: 280,
  hashtagsEnabled: true,
  pollsEnabled: true,
  mediaEnabled: true,
  verifiedBadgesEnabled: true,
};

const CONFIG_KEYS = [
  "twaater_max_length",
  "twaater_hashtags_enabled",
  "twaater_polls_enabled",
  "twaater_media_enabled",
  "twaater_verified_enabled",
] as const;

export const useTwaaterConfig = () =>
  useQuery({
    queryKey: ["twaater-runtime-config"],
    queryFn: async (): Promise<TwaaterRuntimeConfig> => {
      const { data, error } = await supabase
        .from("game_balance_config")
        .select("key, value")
        .in("key", [...CONFIG_KEYS]);

      if (error) throw error;

      const values = new Map((data || []).map((row: any) => [row.key, Number(row.value)]));
      const maxLength = Math.max(100, Math.min(500, Math.round(values.get("twaater_max_length") ?? DEFAULTS.maxLength)));

      return {
        maxLength,
        hashtagsEnabled: (values.get("twaater_hashtags_enabled") ?? 1) !== 0,
        pollsEnabled: (values.get("twaater_polls_enabled") ?? 1) !== 0,
        mediaEnabled: (values.get("twaater_media_enabled") ?? 1) !== 0,
        verifiedBadgesEnabled: (values.get("twaater_verified_enabled") ?? 1) !== 0,
      };
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: DEFAULTS,
  });
