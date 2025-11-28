import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useTwaaterAIFeed = (accountId?: string) => {
  return useQuery({
    queryKey: ["twaater-ai-feed", accountId],
    queryFn: async () => {
      if (!accountId) {
        // Fallback to regular feed if no account
        const { data, error } = await supabase
          .from("twaats")
          .select(`
            *,
            account:twaater_accounts(id, handle, display_name, verified, owner_type, fame_score),
            metrics:twaat_metrics(*)
          `)
          .eq("visibility", "public")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;
        return data;
      }

      // Call AI feed engine
      const { data: aiData, error: aiError } = await supabase.functions.invoke("twaater-ai-feed", {
        body: { account_id: accountId },
      });

      if (aiError) {
        console.error("AI feed error:", aiError);
        // Fallback to regular feed
        const { data, error } = await supabase
          .from("twaats")
          .select(`
            *,
            account:twaater_accounts(id, handle, display_name, verified, owner_type, fame_score),
            metrics:twaat_metrics(*)
          `)
          .eq("visibility", "public")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;
        return data;
      }

      return aiData.ranked_feed || [];
    },
    enabled: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};
