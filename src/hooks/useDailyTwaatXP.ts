import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useDailyTwaatXP = (accountId?: string) => {
  const { data: dailyAward, isLoading } = useQuery({
    queryKey: ["daily-twaat-xp", accountId],
    queryFn: async () => {
      if (!accountId) return null;

      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from("twaater_daily_awards")
        .select("*")
        .eq("account_id", accountId)
        .eq("date", today)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  const twaatsPostedToday = dailyAward?.twaats_awarded || 0;
  const xpEarnedToday = dailyAward?.xp_awarded || 0;
  const canEarnMore = twaatsPostedToday < 3;

  return {
    twaatsPostedToday,
    xpEarnedToday,
    canEarnMore,
    isLoading,
  };
};
