import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TwaatCard } from "@/components/twaater/TwaatCard";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Hash } from "lucide-react";
import { useTwaaterAccount } from "@/hooks/useTwaaterAccount";
import { useGameData } from "@/hooks/useGameData";

export default function TwaaterHashtagView() {
  const { hashtag } = useParams();
  const { profile } = useGameData();
  const { account } = useTwaaterAccount("persona", profile?.id);

  const { data: twaats, isLoading } = useQuery({
    queryKey: ["hashtag-feed", hashtag],
    queryFn: async () => {
      if (!hashtag) return [];

      const { data, error } = await supabase
        .from("twaats")
        .select(`
          *,
          account:twaater_accounts(id, handle, display_name, verified, owner_type, fame_score),
          metrics:twaat_metrics(*)
        `)
        .ilike("body", `%#${hashtag}%`)
        .eq("visibility", "public")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: !!hashtag,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4">
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Hash className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">#{hashtag}</h1>
                <p className="text-muted-foreground">
                  {twaats?.length || 0} {twaats?.length === 1 ? 'twaat' : 'twaats'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

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
      </div>
    </div>
  );
}