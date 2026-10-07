import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TwaatCard } from "@/components/twaater/TwaatCard";
import { TwaaterLogo } from "@/components/twaater/TwaaterLogo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useTwaaterAccount } from "@/hooks/useTwaaterAccount";
import { useGameData } from "@/hooks/useGameData";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { hydrateTwaaterFeedExtras } from "@/hooks/useTwaats";
import { useTwaaterRouteAccount } from "@/hooks/useTwaaterRouteAccount";

export default function TwaaterTwaatView() {
  const { twaatId } = useParams();
  const navigate = useNavigate();
  const { profile } = useGameData();
  const [searchParams] = useSearchParams();
  const { account: personaAccount, isLoading: personaLoading } = useTwaaterAccount("persona", profile?.id);
  const { account, isLoading: routeAccountLoading } = useTwaaterRouteAccount(personaAccount, searchParams.get("account"));
  const backTo = account?.id ? `/twaater?account=${account.id}` : "/twaater";

  // Fetch main twaat
  const { data: twaat, isLoading, error: twaatError, refetch: refetchTwaat } = useQuery({
    queryKey: ["twaat-detail", twaatId],
    queryFn: async (): Promise<any> => {
      if (!twaatId) return null;

      const { data, error } = await supabase
        .from("twaats")
        .select(`
          *,
          account:twaater_accounts!twaats_account_id_fkey(id, handle, display_name, verified, owner_type, fame_score),
          metrics:twaat_metrics(*)
        `)
        .eq("id", twaatId)
        .is("deleted_at", null)
        .is("scheduled_for", null)
        .maybeSingle();

      if (error) throw error;
      const hydrated = await hydrateTwaaterFeedExtras(data ? [data] : []);
      return hydrated[0] || null;
    },
    enabled: !!twaatId,
  });

  // Fetch replies
  const { data: replies, isLoading: repliesLoading, error: repliesError, refetch: refetchReplies } = useQuery<any[]>({
    queryKey: ["twaat-replies", twaatId],
    queryFn: async () => {
      if (!twaatId) return [];

      const { data, error } = await supabase
        .from("twaat_replies")
        .select(`
          id,
          body,
          created_at,
          account:twaater_accounts!twaat_replies_account_id_fkey(id, handle, display_name, verified)
        `)
        .eq("parent_twaat_id", twaatId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!twaatId,
  });

  if (isLoading || personaLoading || routeAccountLoading) {
    return (
      <FMPageScaffold title="Twaat" icon={MessageCircle} backTo={backTo}>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </FMPageScaffold>
    );
  }

  if (twaatError) {
    return (
      <FMPageScaffold title="Twaat" icon={MessageCircle} backTo={backTo}>
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-muted-foreground">This Twaat couldn't load.</p>
            <Button variant="outline" size="sm" onClick={() => refetchTwaat()}>Retry</Button>
          </CardContent>
        </Card>
      </FMPageScaffold>
    );
  }

  if (!twaat) {
    return (
      <FMPageScaffold title="Twaat" icon={MessageCircle} backTo={backTo}>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">Twaat not found</p>
            <Button onClick={() => navigate(backTo)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Feed
            </Button>
          </CardContent>
        </Card>
      </FMPageScaffold>
    );
  }

  return (
    <FMPageScaffold title="Twaat" icon={MessageCircle} backTo={backTo} backLabel="Back to Twaater">
      <div className="rounded-sm border border-fm-border overflow-hidden" style={{ backgroundColor: "hsl(var(--twaater-bg))" }}>
        {/* Main Twaat */}
        <TwaatCard twaat={twaat} viewerAccountId={account?.id} />

        {/* Replies Section */}
        <div className="border-t" style={{ borderColor: "hsl(var(--twaater-border))" }}>
          <div className="px-4 py-3 flex items-center gap-2">
            <MessageCircle className="h-5 w-5" style={{ color: "hsl(var(--twaater-purple))" }} />
            <span className="font-semibold">
              {replies?.length || 0} {replies?.length === 1 ? "Reply" : "Replies"}
            </span>
          </div>

          {repliesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : repliesError ? (
            <Card className="mx-4 mb-4" style={{ backgroundColor: "hsl(var(--twaater-card))" }}>
              <CardContent className="py-8 text-center space-y-3">
                <p className="text-muted-foreground">Replies couldn't load.</p>
                <Button variant="outline" size="sm" onClick={() => refetchReplies()}>Retry</Button>
              </CardContent>
            </Card>
          ) : replies && replies.length > 0 ? (
            <div>
              {replies.map((reply: any) => (
                <div
                  key={reply.id}
                  className="border-b p-4 last:border-b-0"
                  style={{ borderColor: "hsl(var(--twaater-border))", backgroundColor: "hsl(var(--twaater-card))" }}
                >
                  <div className="flex items-center gap-2 text-sm mb-2">
                    <span className="font-semibold">{reply.account?.display_name || "Unknown account"}</span>
                    {reply.account?.handle && <span className="text-muted-foreground">@{reply.account.handle}</span>}
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">
                      {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">{reply.body}</p>
                </div>
              ))}
            </div>
          ) : (
            <Card className="mx-4 mb-4" style={{ backgroundColor: "hsl(var(--twaater-card))" }}>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No replies yet. Be the first to reply!</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </FMPageScaffold>
  );
}
