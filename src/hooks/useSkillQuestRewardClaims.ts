import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SkillQuestRewardClaim {
  id: string;
  profile_id: string;
  quest_id: string;
  status: "pending" | "processing" | "granted" | "retry_required";
  reward_kind: "xp";
  reward_amount: number;
  granted_at: string | null;
}

const PAGE_SIZE = 100;

/** Read every server-owned reward claim; never hide older claims behind a fixed limit. */
export const useSkillQuestRewardClaims = (profileId: string | null | undefined) =>
  useQuery({
    queryKey: ["skill-quest-reward-claims", profileId],
    enabled: Boolean(profileId),
    queryFn: async (): Promise<SkillQuestRewardClaim[]> => {
      if (!profileId) return [];
      const claims: SkillQuestRewardClaim[] = [];
      let offset = 0;
      for (;;) {
        const { data, error } = await supabase
          .from("skill_quest_reward_claims" as never)
          .select("id,profile_id,quest_id,status,reward_kind,reward_amount,granted_at")
          .eq("profile_id", profileId)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);
        if (error) throw error;
        const page = (data ?? []) as unknown as SkillQuestRewardClaim[];
        claims.push(...page);
        if (page.length < PAGE_SIZE) return claims;
        offset += PAGE_SIZE;
      }
    },
  });
