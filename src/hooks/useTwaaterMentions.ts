import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { hydrateTwaaterFeedExtras } from "@/hooks/useTwaats";

export const useTwaaterMentions = (accountId?: string) => {
  const { data: mentions, isLoading, error, refetch } = useQuery({
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
        .limit(500);

      if (error) throw error;

      const followersOnlyAuthors = Array.from(new Set((data || []).filter((mention: any) => mention.twaat?.visibility === "followers" && mention.twaat?.account_id !== accountId).map((mention: any) => mention.twaat.account_id)));
      let followedAuthorIds = new Set<string>();
      if (followersOnlyAuthors.length) {
        const { data: follows, error: followsError } = await supabase.from("twaater_follows").select("followed_account_id").eq("follower_account_id", accountId!).in("followed_account_id", followersOnlyAuthors);
        if (followsError) throw followsError;
        followedAuthorIds = new Set((follows || []).map(row => row.followed_account_id));
      }
      const rows = (data || []).filter((mention: any) => {
        const twaat = mention.twaat;
        return twaat && !twaat.deleted_at && !twaat.scheduled_for && (twaat.visibility === "public" || twaat.account_id === accountId || (twaat.visibility === "followers" && followedAuthorIds.has(twaat.account_id)));
      });
      const twaats = rows.map((mention: any) => mention.twaat);
      const hydrated = await hydrateTwaaterFeedExtras(twaats, accountId);
      const hydratedById = new Map(hydrated.map((twaat: any) => [twaat.id, twaat]));

      return rows
        .filter((mention: any) => Boolean(mention.twaat))
        .map((mention: any) => ({
          ...mention,
          twaat: hydratedById.get(mention.twaat.id) || mention.twaat,
        }));
    },
    enabled: !!accountId,
  });

  return { mentions, isLoading, error, refetch };
};
