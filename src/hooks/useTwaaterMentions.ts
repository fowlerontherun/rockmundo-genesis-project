import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { hydrateTwaaterFeedExtras } from "@/hooks/useTwaats";

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

      const rows = data || [];
      const twaats = rows.map((mention: any) => mention.twaat).filter(Boolean);
      const hydrated = await hydrateTwaaterFeedExtras(twaats);
      const hydratedById = new Map(hydrated.map((twaat: any) => [twaat.id, twaat]));

      return rows.map((mention: any) => ({
        ...mention,
        twaat: mention.twaat ? hydratedById.get(mention.twaat.id) || mention.twaat : null,
      }));
    },
    enabled: !!accountId,
  });

  return { mentions, isLoading };
};
