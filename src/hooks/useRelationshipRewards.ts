import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";

export interface SocialStreak {
  current_streak: number;
  total_days: number;
  longest_streak: number;
  last_interaction_date: string | null;
}

export function useSocialStreak() {
  const { profileId } = useActiveProfile();

  return useQuery<SocialStreak>({
    queryKey: ["social-streak", profileId],
    queryFn: async () => {
      if (!profileId) {
        return { current_streak: 0, total_days: 0, longest_streak: 0, last_interaction_date: null };
      }
      const { data } = await supabase
        .from("daily_social_streaks" as any)
        .select("current_streak, total_days, longest_streak, last_interaction_date")
        .eq("profile_id", profileId)
        .maybeSingle();
      const row = data as { current_streak: number; total_days: number; longest_streak: number; last_interaction_date: string | null } | null;
      return row ?? { current_streak: 0, total_days: 0, longest_streak: 0, last_interaction_date: null };
    },
    enabled: !!profileId,
    staleTime: 30_000,
  });
}

export interface FriendRewardSummary {
  lifetime_xp: number;
  tier: string;
  recent_actions: number;
}

export function useFriendRewardSummary(otherProfileId: string | null) {
  const { profileId } = useActiveProfile();

  return useQuery<FriendRewardSummary>({
    queryKey: ["friend-rewards", profileId, otherProfileId],
    queryFn: async () => {
      if (!profileId || !otherProfileId) {
        return { lifetime_xp: 0, tier: "acquaintance", recent_actions: 0 };
      }
      const pairKey = [profileId, otherProfileId].sort().join(":");
      const { data } = await supabase
        .from("relationship_xp_log" as any)
        .select("xp_awarded, created_at")
        .eq("pair_key", pairKey);
      const rows = (data ?? []) as Array<{ xp_awarded: number; created_at: string }>;
      const lifetime = rows.reduce((sum, r) => sum + (r.xp_awarded ?? 0), 0);
      const since = Date.now() - 7 * 86_400_000;
      const recent = rows.filter((r) => new Date(r.created_at).getTime() >= since).length;
      let tier = "acquaintance";
      if (lifetime >= 1000) tier = "legendary-duo";
      else if (lifetime >= 600) tier = "inner-circle";
      else if (lifetime >= 250) tier = "bandmate";
      return { lifetime_xp: lifetime, tier, recent_actions: recent };
    },
    enabled: !!profileId && !!otherProfileId,
    staleTime: 15_000,
  });
}

export interface RelationshipActionResult {
  success: boolean;
  xp_awarded?: number;
  skill_xp_awarded?: number;
  skill_slug?: string | null;
  cap_remaining?: number;
  streak_days?: number;
  streak_bonus?: { xp: number; skillXp: number; label: string } | null;
  tier?: string;
  lifetime_xp?: number;
  action_label?: string;
  error?: string;
}

export async function executeRelationshipAction(input: {
  action: string;
  profileId: string;
  otherProfileId: string;
  message?: string;
  metadata?: Record<string, unknown>;
}): Promise<RelationshipActionResult> {
  const { data, error } = await supabase.functions.invoke("relationship-action", {
    body: {
      action: input.action,
      profile_id: input.profileId,
      other_profile_id: input.otherProfileId,
      message: input.message,
      metadata: input.metadata,
    },
  });
  if (error) {
    return { success: false, error: error.message };
  }
  return data as RelationshipActionResult;
}
