import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";

export interface CoopQuestEvent {
  id: string;
  quest_id: string;
  pair_key: string;
  actor_profile_id: string;
  event_type: "started" | "progress" | "completed" | "claimed";
  progress_a: number | null;
  progress_b: number | null;
  note: string | null;
  created_at: string;
  // Joined / derived fields
  quest_title?: string | null;
  quest_cadence?: string | null;
  actor_display_name?: string | null;
  /** The OTHER player in the pair (not the active profile). Useful for filtering by friend. */
  friend_profile_id?: string | null;
  friend_display_name?: string | null;
}

/**
 * Recent co-op quest events for a specific friend pair.
 * If `otherProfileId` is omitted, returns events across all of the active profile's pairs.
 */
export function useCoopQuestEvents(otherProfileId?: string | null, limit = 25) {
  const { profileId } = useActiveProfile();

  return useQuery<CoopQuestEvent[]>({
    queryKey: ["coop-quest-events", profileId, otherProfileId ?? "all", limit],
    queryFn: async () => {
      if (!profileId) return [];

      // Build pair_key filter for the specific pair, if provided
      let pairKey: string | null = null;
      if (otherProfileId) {
        pairKey = [profileId, otherProfileId].sort().join(":");
      }

      let query = (supabase as any)
        .from("coop_quest_events")
        .select("id, quest_id, pair_key, actor_profile_id, event_type, progress_a, progress_b, note, created_at, coop_quests!inner(title, cadence, profile_a_id, profile_b_id)")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (pairKey) {
        query = query.eq("pair_key", pairKey);
      } else {
        query = query.or(`coop_quests.profile_a_id.eq.${profileId},coop_quests.profile_b_id.eq.${profileId}`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data ?? []) as any[];

      // Collect every profile id we need to name-resolve: actors AND the friend in each pair.
      const profileIds = new Set<string>();
      for (const r of rows) {
        if (r.actor_profile_id) profileIds.add(r.actor_profile_id);
        const a = r.coop_quests?.profile_a_id;
        const b = r.coop_quests?.profile_b_id;
        if (a) profileIds.add(a);
        if (b) profileIds.add(b);
      }

      const nameMap = new Map<string, string>();
      if (profileIds.size > 0) {
        const { data: profiles } = await (supabase as any)
          .from("profiles")
          .select("id, display_name, username")
          .in("id", Array.from(profileIds));
        for (const p of profiles ?? []) {
          nameMap.set(p.id, p.display_name ?? p.username ?? "Unknown");
        }
      }

      return rows.map((r) => {
        const a = r.coop_quests?.profile_a_id ?? null;
        const b = r.coop_quests?.profile_b_id ?? null;
        const friendId = a && a !== profileId ? a : b && b !== profileId ? b : null;
        return {
          id: r.id,
          quest_id: r.quest_id,
          pair_key: r.pair_key,
          actor_profile_id: r.actor_profile_id,
          event_type: r.event_type,
          progress_a: r.progress_a,
          progress_b: r.progress_b,
          note: r.note,
          created_at: r.created_at,
          quest_title: r.coop_quests?.title ?? null,
          quest_cadence: r.coop_quests?.cadence ?? null,
          actor_display_name: nameMap.get(r.actor_profile_id) ?? null,
          friend_profile_id: friendId,
          friend_display_name: friendId ? nameMap.get(friendId) ?? null : null,
        } as CoopQuestEvent;
      });
    },
    enabled: !!profileId,
    staleTime: 15_000,
  });
}
