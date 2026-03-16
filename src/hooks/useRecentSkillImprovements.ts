import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subHours } from "date-fns";

export interface SkillImprovement {
  id: string;
  skill_name: string;
  previous_value: number;
  new_value: number;
  improvement_amount: number;
  improved_at: string;
}

export const useRecentSkillImprovements = (profileId?: string, hoursAgo: number = 24) => {
  return useQuery({
    queryKey: ["skill-improvements", profileId, hoursAgo],
    queryFn: async () => {
      if (!profileId) return [];
      
      const cutoffTime = subHours(new Date(), hoursAgo).toISOString();
      
      const { data, error } = await (supabase as any)
        .from("skill_improvements")
        .select("*")
        .eq("profile_id", profileId)
        .gte("improved_at", cutoffTime)
        .order("improved_at", { ascending: false });

      if (error) throw error;
      return data as SkillImprovement[];
    },
    enabled: !!profileId,
  });
};
