import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { RELATIONSHIP_ACTION_REWARDS } from "@/features/relationships/rewardsConfig";

export interface WeeklyRecap {
  totalXp: number;
  totalSkillXp: number;
  interactions: number;
  uniqueFriends: number;
  topFriendId: string | null;
  topFriendName: string | null;
  topFriendXp: number;
  topActionType: string | null;
  topActionCount: number;
}

export function useWeeklyRelationshipRecap() {
  const { profileId } = useActiveProfile();

  return useQuery<WeeklyRecap>({
    queryKey: ["relationship-weekly-recap", profileId],
    queryFn: async () => {
      const empty: WeeklyRecap = {
        totalXp: 0,
        totalSkillXp: 0,
        interactions: 0,
        uniqueFriends: 0,
        topFriendId: null,
        topFriendName: null,
        topFriendXp: 0,
        topActionType: null,
        topActionCount: 0,
      };
      if (!profileId) return empty;

      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: rows } = await (supabase as any)
        .from("relationship_xp_log")
        .select("action_type, xp_awarded, skill_xp_awarded, other_profile_id, created_at")
        .eq("profile_id", profileId)
        .gte("created_at", since)
        .limit(1000);

      const list = (rows ?? []) as Array<{
        action_type: string;
        xp_awarded: number;
        skill_xp_awarded: number;
        other_profile_id: string;
      }>;
      if (list.length === 0) return empty;

      const friendXp = new Map<string, number>();
      const actionCount = new Map<string, number>();
      let totalXp = 0;
      let totalSkillXp = 0;

      for (const r of list) {
        totalXp += r.xp_awarded ?? 0;
        totalSkillXp += r.skill_xp_awarded ?? 0;
        friendXp.set(r.other_profile_id, (friendXp.get(r.other_profile_id) ?? 0) + (r.xp_awarded ?? 0));
        actionCount.set(r.action_type, (actionCount.get(r.action_type) ?? 0) + 1);
      }

      const [topFriendId, topFriendXp] = Array.from(friendXp.entries()).sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
      const [topActionType, topActionCount] = Array.from(actionCount.entries()).sort((a, b) => b[1] - a[1])[0] ?? [null, 0];

      let topFriendName: string | null = null;
      if (topFriendId) {
        const { data: prof } = await (supabase as any)
          .from("profiles")
          .select("display_name, username")
          .eq("id", topFriendId)
          .maybeSingle();
        topFriendName = prof?.display_name ?? prof?.username ?? null;
      }

      return {
        totalXp,
        totalSkillXp,
        interactions: list.length,
        uniqueFriends: friendXp.size,
        topFriendId,
        topFriendName,
        topFriendXp,
        topActionType,
        topActionCount,
      };
    },
    enabled: !!profileId,
    staleTime: 60_000,
  });
}

export interface CoopSuggestion {
  otherProfileId: string;
  otherDisplayName: string | null;
  otherUsername: string | null;
  potentialXp: number;
  availableActions: Array<{ id: string; label: string; xp: number; remaining: number }>;
}

/**
 * Suggests friends + actions where today's daily cap has not been hit,
 * sorted by potential XP unlock.
 */
export function useCoopSuggestions(friendProfileIds: string[], limit = 3) {
  const { profileId } = useActiveProfile();

  return useQuery<CoopSuggestion[]>({
    queryKey: ["coop-suggestions", profileId, friendProfileIds.sort().join(","), limit],
    queryFn: async () => {
      if (!profileId || friendProfileIds.length === 0) return [];

      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);

      const { data: rows } = await (supabase as any)
        .from("relationship_xp_log")
        .select("other_profile_id, action_type")
        .eq("profile_id", profileId)
        .in("other_profile_id", friendProfileIds)
        .gte("created_at", startOfDay.toISOString())
        .limit(1000);

      const usage = new Map<string, Map<string, number>>(); // friendId -> actionType -> count
      for (const r of (rows ?? []) as Array<{ other_profile_id: string; action_type: string }>) {
        if (!usage.has(r.other_profile_id)) usage.set(r.other_profile_id, new Map());
        const m = usage.get(r.other_profile_id)!;
        m.set(r.action_type, (m.get(r.action_type) ?? 0) + 1);
      }

      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select("id, display_name, username")
        .in("id", friendProfileIds);
      const profileMap = new Map<string, { display_name: string | null; username: string | null }>();
      for (const p of profiles ?? []) profileMap.set(p.id, { display_name: p.display_name, username: p.username });

      const suggestions: CoopSuggestion[] = friendProfileIds.map((fid) => {
        const used = usage.get(fid) ?? new Map();
        const available: CoopSuggestion["availableActions"] = [];
        let potential = 0;
        for (const cfg of Object.values(RELATIONSHIP_ACTION_REWARDS)) {
          if (cfg.id === "teach") continue;
          const usedCount = used.get(cfg.id) ?? 0;
          const remaining = Math.max(0, cfg.dailyCap - usedCount);
          if (remaining > 0) {
            available.push({ id: cfg.id, label: cfg.label, xp: cfg.xp, remaining });
            potential += cfg.xp * remaining;
          }
        }
        const prof = profileMap.get(fid);
        return {
          otherProfileId: fid,
          otherDisplayName: prof?.display_name ?? null,
          otherUsername: prof?.username ?? null,
          potentialXp: potential,
          availableActions: available.sort((a, b) => b.xp - a.xp).slice(0, 4),
        };
      });

      return suggestions
        .filter((s) => s.potentialXp > 0)
        .sort((a, b) => b.potentialXp - a.potentialXp)
        .slice(0, limit);
    },
    enabled: !!profileId && friendProfileIds.length > 0,
    staleTime: 30_000,
  });
}
