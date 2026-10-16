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

/**
 * An independent seasonal notice: it does not overwrite the normal public
 * announcement_banner. Keep disabled until server-authoritative rewards ship.
 */
export interface HalloweenEventConfig {
  enabled: boolean;
  rewards_live: boolean;
  starts_at: string;
  ends_at: string;
}

export const DEFAULT_HALLOWEEN_EVENT: HalloweenEventConfig = {
  enabled: false,
  rewards_live: false,
  // 00:00 Europe/London, 24 Oct 2026 (BST).
  starts_at: "2026-10-23T23:00:00Z",
  // 00:00 Europe/London, 2 Nov 2026 (GMT).
  ends_at: "2026-11-02T00:00:00Z",
};

export const SITE_CONFIG_KEYS = ["server_status", "announcement_banner", "halloween_2026_event"] as const;

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
      const halloween: HalloweenEventConfig = {
        ...DEFAULT_HALLOWEEN_EVENT,
        ...(map.get("halloween_2026_event") || {}),
      };
      return { server, announcement, halloween };
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
