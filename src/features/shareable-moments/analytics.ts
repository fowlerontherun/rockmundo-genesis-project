import { supabase } from "@/integrations/supabase/client";
import type { ShareFormat, ShareMomentType } from "./types";

export type ShareAnalyticsEvent =
  | "share_prompt_viewed"
  | "share_studio_opened"
  | "share_rendered"
  | "share_native_started"
  | "share_downloaded"
  | "share_link_copied";

export type ShareAnalyticsChannel =
  | "native"
  | "download"
  | "copy_link"
  | "twaater"
  | "studio"
  | "prompt"
  | "render";

export function trackShareAnalyticsEvent(
  eventName: ShareAnalyticsEvent,
  options: {
    momentType?: ShareMomentType | string | null;
    format?: ShareFormat | null;
    template?: string | null;
    channel?: ShareAnalyticsChannel | null;
  } = {},
) {
  void (supabase.rpc as any)("record_share_analytics_event", {
    p_event_name: eventName,
    p_moment_type: options.momentType ?? null,
    p_share_format: options.format ?? null,
    p_template: options.template ?? null,
    p_channel: options.channel ?? null,
  }).then(({ error }: { error?: { message?: string } | null }) => {
    if (error && import.meta.env.DEV) {
      console.debug("Share analytics event was not recorded", eventName, error.message);
    }
  }).catch(() => {
    // Analytics must never block sharing.
  });
}
