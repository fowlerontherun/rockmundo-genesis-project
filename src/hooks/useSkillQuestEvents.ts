import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SkillQuestEvent {
  id: string;
  profile_id: string;
  quest_id: string;
  source_type: string;
  source_id: string;
  recorded_at: string;
}

const PAGE_SIZE = 500;

/** Read-only view of all server-verified activity events, not just the newest 500. */
export function useSkillQuestEvents(profileId?: string | null) {
  return useQuery({
    queryKey: ["skill-quest-events", profileId],
    enabled: !!profileId,
    queryFn: async (): Promise<SkillQuestEvent[]> => {
      const events: SkillQuestEvent[] = [];
      let offset = 0;
      for (;;) {
        const { data, error } = await supabase
          .from("skill_quest_events" as never)
          .select("id,profile_id,quest_id,source_type,source_id,recorded_at")
          .eq("profile_id", profileId!)
          .order("recorded_at", { ascending: false })
          .order("id", { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);
        if (error) throw error;
        const page = (data ?? []) as unknown as SkillQuestEvent[];
        events.push(...page);
        if (page.length < PAGE_SIZE) return events;
        offset += PAGE_SIZE;
      }
    },
    staleTime: 30_000,
  });
}
