import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useTwaaterMentions = (accountId?: string) => {
  const { data: mentions, isLoading } = useQuery({
    queryKey: ["twaater-mentions", accountId],
    queryFn: async () => {
      if (!accountId) return [];

      const { data, error } = await supabase
        .from("twaater_mentions")
        .select(`
          *,
          twaat:twaats(
            *,
            account:twaater_accounts!twaats_account_id_fkey(id, handle, display_name, verified),
            metrics:twaat_metrics(*)
          )
        `)
        .eq("mentioned_account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  return { mentions, isLoading };
};
