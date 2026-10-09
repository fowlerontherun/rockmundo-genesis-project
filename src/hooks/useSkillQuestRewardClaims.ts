import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SkillQuestRewardClaim {
  id: string;
  profile_id: string;
  quest_id: string;
  status: "pending" | "granted" | "failed";
  reward_kind: string | null;
  reward_amount: number | null;
  granted_at: string | null;
}

export const useSkillQuestRewardClaims = (profileId: string | null | undefined) =>
  useQuery({
    queryKey: ["skill-quest-reward-claims", profileId],
    enabled: Boolean(profileId),
    queryFn: async (): Promise<SkillQuestRewardClaim[]> => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("skill_quest_reward_claims" as never)
        .select("id,profile_id,quest_id,status,reward_kind,reward_amount,granted_at")
        .eq("profile_id", profileId)
        .limit(100);
      if (error) throw error;
      return (data ?? []) as SkillQuestRewardClaim[];
    },
  });
