import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Fallback query function for chronological feed
const fetchChronologicalFeed = async () => {
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
  return data || [];
};

export const useTwaaterAIFeed = (accountId?: string) => {
  return useQuery({
    queryKey: ["twaater-ai-feed", accountId],
    queryFn: async () => {
      if (!accountId) {
        // Fallback to regular feed if no account
        return fetchChronologicalFeed();
      }

      try {
        // Call AI feed engine
        const { data: aiData, error: aiError } = await supabase.functions.invoke("twaater-ai-feed", {
          body: { account_id: accountId },
        });

        if (aiError) {
          console.error("AI feed error:", aiError);
          return fetchChronologicalFeed();
        }

        const rankedFeed = aiData?.ranked_feed;
        
        // If AI returned empty or no data, fallback to chronological
        if (!rankedFeed || !Array.isArray(rankedFeed) || rankedFeed.length === 0) {
          console.log("AI feed returned empty, falling back to chronological");
          return fetchChronologicalFeed();
        }

        return rankedFeed;
      } catch (error) {
        console.error("AI feed exception:", error);
        return fetchChronologicalFeed();
      }
    },
    enabled: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};
