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

/** Read-only view of server-verified activity events. Clients cannot write quest progress. */
export function useSkillQuestEvents(profileId?: string | null) {
  return useQuery({
    queryKey: ["skill-quest-events", profileId],
    enabled: !!profileId,
    queryFn: async (): Promise<SkillQuestEvent[]> => {
      const { data, error } = await supabase
        .from("skill_quest_events" as never)
        .select("id,profile_id,quest_id,source_type,source_id,recorded_at")
        .eq("profile_id", profileId!)
        .order("recorded_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as SkillQuestEvent[];
    },
    staleTime: 30_000,
  });
}
