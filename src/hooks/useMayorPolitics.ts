import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { POLITICS_SKILLS, POLITICS_THRESHOLDS, type PoliticsSkillSlug } from "@/types/city-projects";

export interface PoliticsSkillLevels {
  basic_public_speaking: number;
  basic_negotiation: number;
  basic_governance: number;
  professional_diplomacy: number;
  professional_campaign_strategy: number;
  master_statecraft: number;
}

export interface MayorPoliticsState {
  levels: PoliticsSkillLevels;
  totalLevel: number;
  unlocks: {
    proposeProjects: boolean; // governance >= BASIC
    advancedProjects: boolean; // governance >= PROFESSIONAL
    tradeDeals: boolean; // diplomacy >= PROFESSIONAL
    pressConferences: boolean; // public_speaking >= 50
    decrees: boolean; // statecraft >= PROFESSIONAL
    referendums: boolean; // statecraft >= MASTER
    campaignBoost: number; // 0-50% bonus to vote count
    projectDiscount: number; // 0-15% cost reduction
  };
}

const DEFAULT_LEVELS: PoliticsSkillLevels = {
  basic_public_speaking: 0,
  basic_negotiation: 0,
  basic_governance: 0,
  professional_diplomacy: 0,
  professional_campaign_strategy: 0,
  master_statecraft: 0,
};

export function useMayorPolitics(profileId: string | undefined) {
  return useQuery<MayorPoliticsState>({
    queryKey: ["mayor-politics", profileId],
    queryFn: async () => {
      if (!profileId) {
        return { levels: DEFAULT_LEVELS, totalLevel: 0, unlocks: computeUnlocks(DEFAULT_LEVELS) };
      }
      const { data } = await supabase
        .from("skill_progress")
        .select("skill_slug, current_level, current_xp")
        .eq("profile_id", profileId)
        .in("skill_slug", POLITICS_SKILLS as unknown as string[]);

      const levels: PoliticsSkillLevels = { ...DEFAULT_LEVELS };
      let totalLevel = 0;
      for (const row of data ?? []) {
        const slug = row.skill_slug as PoliticsSkillSlug;
        const value = (row.current_xp ?? row.current_level ?? 0) as number;
        if (slug in levels) {
          (levels as Record<string, number>)[slug] = value;
          totalLevel += value;
        }
      }

      return { levels, totalLevel, unlocks: computeUnlocks(levels) };
    },
    enabled: !!profileId,
  });
}

function computeUnlocks(levels: PoliticsSkillLevels): MayorPoliticsState['unlocks'] {
  return {
    proposeProjects: levels.basic_governance >= POLITICS_THRESHOLDS.BASIC,
    advancedProjects: levels.basic_governance >= POLITICS_THRESHOLDS.PROFESSIONAL,
    tradeDeals: levels.professional_diplomacy >= POLITICS_THRESHOLDS.PROFESSIONAL,
    pressConferences: levels.basic_public_speaking >= 50,
    decrees: levels.master_statecraft >= POLITICS_THRESHOLDS.PROFESSIONAL,
    referendums: levels.master_statecraft >= POLITICS_THRESHOLDS.MASTER,
    campaignBoost: Math.min(50, Math.floor(levels.professional_campaign_strategy / 16)),
    projectDiscount: Math.min(15, Math.floor(levels.basic_negotiation / 50) + 5),
  };
}
