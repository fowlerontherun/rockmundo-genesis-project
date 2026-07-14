import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ServerStatusLevel = "up" | "degraded" | "down";

export interface ServerStatusConfig {
  status: ServerStatusLevel;
  message: string;
}

export interface AnnouncementBannerConfig {
  enabled: boolean;
  title: string;
  body: string;
  cta_label?: string;
  cta_url?: string;
}

export const DEFAULT_SERVER_STATUS: ServerStatusConfig = {
  status: "up",
  message: "RockMundo is online.",
};

export const DEFAULT_ANNOUNCEMENT: AnnouncementBannerConfig = {
  enabled: false,
  title: "",
  body: "",
  cta_label: "",
  cta_url: "",
};

export const SITE_CONFIG_KEYS = ["server_status", "announcement_banner"] as const;

export function useSiteConfig() {
  return useQuery({
    queryKey: ["site-config"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("system_settings")
        .select("key,value")
        .in("key", SITE_CONFIG_KEYS as unknown as string[]);
      if (error) throw error;
      const map = new Map<string, any>((data || []).map((r: any) => [r.key, r.value]));
      const server: ServerStatusConfig = {
        ...DEFAULT_SERVER_STATUS,
        ...(map.get("server_status") || {}),
      };
      const announcement: AnnouncementBannerConfig = {
        ...DEFAULT_ANNOUNCEMENT,
        ...(map.get("announcement_banner") || {}),
      };
      return { server, announcement };
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
