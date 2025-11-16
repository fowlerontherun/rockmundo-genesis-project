import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useDikCokChallenges = () => {
  const { data: challenges, isLoading } = useQuery({
    queryKey: ["dikcok-challenges"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("dikcok_challenges")
        .select("*")
        .eq("is_active", true)
        .gte("ends_at", now)
        .order("starts_at", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  return { challenges, isLoading };
};
