import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CoopQuest } from "@/hooks/useCoopQuests";

export interface CoopQuestDetails extends CoopQuest {
  profile_a_name: string | null;
  profile_b_name: string | null;
}

/**
 * Fetch a single co-op quest by id, plus display names for both players.
 * Used by the click-through activity drawer.
 */
export function useCoopQuestDetails(questId: string | null | undefined) {
  return useQuery<CoopQuestDetails | null>({
    queryKey: ["coop-quest-details", questId],
    queryFn: async () => {
      if (!questId) return null;
      const { data: quest, error } = await (supabase as any)
        .from("coop_quests")
        .select("*")
        .eq("id", questId)
        .maybeSingle();
      if (error) throw error;
      if (!quest) return null;

      const ids = [quest.profile_a_id, quest.profile_b_id].filter(Boolean);
      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select("id, display_name, username")
        .in("id", ids);

      const nameOf = (id: string): string | null => {
        const p = (profiles ?? []).find((row: any) => row.id === id);
        if (!p) return null;
        return p.display_name ?? p.username ?? null;
      };

      return {
        ...(quest as CoopQuest),
        profile_a_name: nameOf(quest.profile_a_id),
        profile_b_name: nameOf(quest.profile_b_id),
      } as CoopQuestDetails;
    },
    enabled: !!questId,
    staleTime: 15_000,
  });
}
