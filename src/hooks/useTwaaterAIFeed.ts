import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const twaatSelect = `
  *,
  account:twaater_accounts!twaats_account_id_fkey(id, handle, display_name, verified, owner_type, fame_score),
  metrics:twaat_metrics(*),
  quoted_twaat:twaats!twaats_quoted_twaat_id_fkey(
    id,
    body,
    created_at,
    account:twaater_accounts!twaats_account_id_fkey(id, handle, display_name, verified, owner_type)
  )
`;

const fetchChronologicalFeed = async (accountId?: string) => {
  if (!accountId) {
    const { data, error } = await supabase
      .from("twaats")
      .select(twaatSelect)
      .eq("visibility", "public")
      .is("deleted_at", null)
      .is("scheduled_for", null)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data || [];
  }

  const { data: follows, error: followsError } = await supabase
    .from("twaater_follows")
    .select("followed_account_id")
    .eq("follower_account_id", accountId);
  if (followsError) throw followsError;

  const accountIds = [accountId, ...(follows || []).map((follow) => follow.followed_account_id)];
  const uniqueAccountIds = Array.from(new Set(accountIds));
  const { data, error } = await supabase
    .from("twaats")
    .select(twaatSelect)
    .in("account_id", uniqueAccountIds)
    .is("deleted_at", null)
    .is("scheduled_for", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
};

export const useTwaaterAIFeed = (accountId?: string) => {
  return useQuery({
    queryKey: ["twaater-ai-feed", accountId],
    queryFn: async () => {
      if (!accountId) return fetchChronologicalFeed();

      try {
        const { data: aiData, error: aiError } = await supabase.functions.invoke("twaater-ai-feed", {
          body: { account_id: accountId },
        });

        if (aiError) {
          console.error("AI feed error:", aiError);
          return fetchChronologicalFeed(accountId);
        }

        const rankedFeed = aiData?.ranked_feed;
        if (!rankedFeed || !Array.isArray(rankedFeed) || rankedFeed.length === 0) {
          return fetchChronologicalFeed(accountId);
        }

        return rankedFeed;
      } catch (error) {
        console.error("AI feed exception:", error);
        return fetchChronologicalFeed(accountId);
      }
    },
    enabled: true,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};
