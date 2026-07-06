import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { pushNotification } from "@/lib/notify";
import {
  getPlayerReachTier,
  getNextReachTier,
  getReachTierLabel,
} from "@/utils/mediaReachGate";

/**
 * Reminder notifications when the player is close to unlocking the next
 * reach tier (local → regional → national → international).
 *
 * Fires once per tier per character when fame crosses 85% of the next
 * threshold. Dedupes via notifications.metadata.milestone + profile_id.
 */
const APPROACH_RATIO = 0.85;

export const useReachMilestoneReminders = () => {
  const { user } = useAuth();
  const { profileId, profile } = useActiveProfile();

  useEffect(() => {
    if (!user?.id || !profileId) return;

    const check = async () => {
      const fame = Number(profile?.fame ?? 0);
      const tier = getPlayerReachTier(fame);
      const next = getNextReachTier(tier);
      if (!next) return; // already international

      const threshold = next.fame;
      const remaining = threshold - fame;
      if (fame < threshold * APPROACH_RATIO) return; // not close yet
      if (remaining <= 0) return; // already crossed — reach unlock itself fires elsewhere

      // Dedupe: one reminder per (profile, next tier)
      const { data: existing } = await supabase
        .from("notifications" as any)
        .select("id, metadata")
        .eq("user_id", user.id)
        .eq("category", "achievement")
        .order("created_at", { ascending: false })
        .limit(50);

      const alreadySent = (existing ?? []).some(
        (n: any) =>
          n?.metadata?.reminder_kind === "reach_milestone" &&
          n?.metadata?.milestone === next.tier &&
          n?.metadata?.profile_id === profileId,
      );
      if (alreadySent) return;

      const label = getReachTierLabel(next.tier);
      await pushNotification({
        userId: user.id,
        profileId,
        category: "achievement",
        type: "achievement",
        title: `⭐ Almost ${label}!`,
        message: `Just ${remaining.toLocaleString()} fame to unlock ${label.toLowerCase()}.`,
        actionPath: "/progression",
        metadata: {
          reminder_kind: "reach_milestone",
          milestone: next.tier,
          profile_id: profileId,
          threshold,
          current_fame: fame,
        },
      });
    };

    check();
    const interval = setInterval(check, 5 * 60 * 1000); // every 5 min
    return () => clearInterval(interval);
  }, [user?.id, profileId, profile?.fame]);
};
