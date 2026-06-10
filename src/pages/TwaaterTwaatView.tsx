import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TwaatCard } from "@/components/twaater/TwaatCard";
import { TwaaterLogo } from "@/components/twaater/TwaaterLogo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, MessageCircle } from "lucide-react";
import { useTwaaterAccount } from "@/hooks/useTwaaterAccount";
import { useGameData } from "@/hooks/useGameData";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";

export default function TwaaterTwaatView() {
  const { twaatId } = useParams();
  const navigate = useNavigate();
  const { profile } = useGameData();
  const { account } = useTwaaterAccount("persona", profile?.id);

  // Fetch main twaat
  const { data: twaat, isLoading } = useQuery({
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
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!twaatId,
  });

  // Fetch replies
  const { data: replies } = useQuery<any[]>({
    queryKey: ["twaat-replies", twaatId],
    queryFn: async () => {
      if (!twaatId) return [];

      const { data, error } = await (supabase
        .from("twaats") as any)
        .select("*, account:twaater_accounts!twaats_account_id_fkey(id, handle, display_name, verified, owner_type, fame_score), metrics:twaat_metrics(*)")
        .eq("reply_to_id", twaatId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!twaatId,
  });

  if (isLoading) {
    return (
      <FMPageScaffold title="Twaat" icon={MessageCircle} backTo="/twaater">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </FMPageScaffold>
    );
  }

  if (!twaat) {
    return (
      <FMPageScaffold title="Twaat" icon={MessageCircle} backTo="/twaater">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">Twaat not found</p>
            <Button onClick={() => navigate("/twaater")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Feed
            </Button>
          </CardContent>
        </Card>
      </FMPageScaffold>
    );
  }

  return (
    <FMPageScaffold title="Twaat" icon={MessageCircle} backTo="/twaater" backLabel="Back to Twaater">
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

          {replies && replies.length > 0 ? (
            <div>
              {replies.map((reply: any) => (
                <TwaatCard key={reply.id} twaat={reply} viewerAccountId={account?.id} />
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
