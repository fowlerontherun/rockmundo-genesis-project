import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";

export interface RelationshipFeedItem {
  id: string;
  action_type: string;
  xp_awarded: number;
  skill_xp_awarded: number;
  skill_slug: string | null;
  created_at: string;
  other_profile_id: string;
  other_display_name: string | null;
  other_username: string | null;
}

export function useRelationshipFeed(limit = 12) {
  const { profileId } = useActiveProfile();

  return useQuery<RelationshipFeedItem[]>({
    queryKey: ["relationship-feed", profileId, limit],
    queryFn: async () => {
      if (!profileId) return [];
      const { data: rows } = await (supabase as any)
        .from("relationship_xp_log")
        .select("id, action_type, xp_awarded, skill_xp_awarded, skill_slug, created_at, other_profile_id")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(limit);
      const list = (rows ?? []) as Array<Omit<RelationshipFeedItem, "other_display_name" | "other_username">>;
      if (list.length === 0) return [];

      const otherIds = Array.from(new Set(list.map((r) => r.other_profile_id)));
      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select("id, display_name, username")
        .in("id", otherIds);
      const profileMap = new Map<string, { display_name: string | null; username: string | null }>();
      for (const p of profiles ?? []) {
        profileMap.set(p.id, { display_name: p.display_name, username: p.username });
      }

      return list.map((r) => ({
        ...r,
        other_display_name: profileMap.get(r.other_profile_id)?.display_name ?? null,
        other_username: profileMap.get(r.other_profile_id)?.username ?? null,
      }));
    },
    enabled: !!profileId,
    staleTime: 15_000,
  });
}

export interface BestFriendItem {
  other_profile_id: string;
  lifetime_xp: number;
  interaction_count: number;
  last_interaction: string;
  other_display_name: string | null;
  other_username: string | null;
  tier: string;
}

function tierFromXp(xp: number): string {
  if (xp >= 1000) return "legendary-duo";
  if (xp >= 600) return "inner-circle";
  if (xp >= 250) return "bandmate";
  return "acquaintance";
}

export function useBestFriends(limit = 5) {
  const { profileId } = useActiveProfile();

  return useQuery<BestFriendItem[]>({
    queryKey: ["best-friends", profileId, limit],
    queryFn: async () => {
      if (!profileId) return [];
      const { data: rows } = await (supabase as any)
        .from("relationship_xp_log")
        .select("other_profile_id, xp_awarded, created_at")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(500);
      const list = (rows ?? []) as Array<{ other_profile_id: string; xp_awarded: number; created_at: string }>;
      if (list.length === 0) return [];

      const agg = new Map<string, { xp: number; count: number; last: string }>();
      for (const r of list) {
        const cur = agg.get(r.other_profile_id) ?? { xp: 0, count: 0, last: r.created_at };
        cur.xp += r.xp_awarded ?? 0;
        cur.count += 1;
        if (r.created_at > cur.last) cur.last = r.created_at;
        agg.set(r.other_profile_id, cur);
      }

      const top = Array.from(agg.entries())
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.xp - a.xp)
        .slice(0, limit);

      const otherIds = top.map((t) => t.id);
      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select("id, display_name, username")
        .in("id", otherIds);
      const profileMap = new Map<string, { display_name: string | null; username: string | null }>();
      for (const p of profiles ?? []) {
        profileMap.set(p.id, { display_name: p.display_name, username: p.username });
      }

      return top.map((t) => ({
        other_profile_id: t.id,
        lifetime_xp: t.xp,
        interaction_count: t.count,
        last_interaction: t.last,
        other_display_name: profileMap.get(t.id)?.display_name ?? null,
        other_username: profileMap.get(t.id)?.username ?? null,
        tier: tierFromXp(t.xp),
      }));
    },
    enabled: !!profileId,
    staleTime: 30_000,
  });
}
