import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TwaatCard } from "@/components/twaater/TwaatCard";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Hash } from "lucide-react";
import { useTwaaterAccount } from "@/hooks/useTwaaterAccount";
import { useGameData } from "@/hooks/useGameData";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { hydrateTwaaterFeedExtras } from "@/hooks/useTwaats";
import { useTwaaterRouteAccount } from "@/hooks/useTwaaterRouteAccount";

export default function TwaaterHashtagView() {
  const { hashtag } = useParams();
  const { profile } = useGameData();
  const [searchParams] = useSearchParams();
  const { account: personaAccount, isLoading: personaLoading } = useTwaaterAccount("persona", profile?.id);
  const { account, isLoading: routeAccountLoading } = useTwaaterRouteAccount(personaAccount, searchParams.get("account"));
  const backTo = account?.id ? `/twaater?account=${account.id}` : "/twaater";

  const { data: twaats, isLoading, error, refetch } = useQuery({
    queryKey: ["hashtag-feed", hashtag],
    queryFn: async () => {
      if (!hashtag) return [];

      const { data, error } = await supabase
        .from("twaats")
        .select(`
          *,
          account:twaater_accounts!twaats_account_id_fkey(id, handle, display_name, verified, owner_type, fame_score),
          metrics:twaat_metrics(*)
        `)
        .ilike("body", `%#${hashtag}%`)
        .eq("visibility", "public")
        .is("deleted_at", null)
        .is("scheduled_for", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return hydrateTwaaterFeedExtras(data || []);
    },
    enabled: !!hashtag,
  });

  if (isLoading || personaLoading || routeAccountLoading) {
    return (
      <FMPageScaffold title={`#${hashtag}`} icon={Hash} backTo={backTo}>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </FMPageScaffold>
    );
  }

  if (error) {
    return (
      <FMPageScaffold title={`#${hashtag}`} icon={Hash} backTo={backTo}>
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-muted-foreground">This hashtag feed couldn't load.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-sm font-medium text-[hsl(var(--twaater-purple))] hover:underline"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </FMPageScaffold>
    );
  }

  return (
    <FMPageScaffold
      title={`#${hashtag}`}
      subtitle={`${twaats?.length || 0} ${twaats?.length === 1 ? 'twaat' : 'twaats'}`}
      icon={Hash}
      backTo={backTo}
      backLabel="Back to Twaater"
    >
      {!twaats || twaats.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">No twaats found with #{hashtag}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {twaats.map((twaat: any) => (
            <TwaatCard
              key={twaat.id}
              twaat={twaat}
              viewerAccountId={account?.id}
            />
          ))}
        </div>
      )}
    </FMPageScaffold>
  );
}
