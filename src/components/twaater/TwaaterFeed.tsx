import { useTwaaterFeed } from "@/hooks/useTwaats";
import { useTwaaterAIFeed } from "@/hooks/useTwaaterAIFeed";
import { useTwaaterMentions } from "@/hooks/useTwaaterMentions";
import TwaaterTimeline from "./TwaaterTimeline";
import { Loader2, Sparkles, RefreshCw, ArrowUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TwaaterFeedProps {
  viewerAccountId?: string;
  feedType?: "feed" | "mentions";
}

export const TwaaterFeed = ({ viewerAccountId, feedType = "feed" }: TwaaterFeedProps) => {
  const [useAI, setUseAI] = useState(true);
  const [newTwaatsCount, setNewTwaatsCount] = useState(0);

  const { feed: regularFeed, isLoading: feedLoading, refetch: refetchRegular } = useTwaaterFeed(feedType === "feed" ? viewerAccountId : undefined);
  const { data: aiFeed, isLoading: aiLoading, refetch: refetchAI } = useTwaaterAIFeed(useAI && feedType === "feed" ? viewerAccountId : undefined);
  const { mentions, isLoading: mentionsLoading } = useTwaaterMentions(feedType === "mentions" ? viewerAccountId : undefined);

  const isLoading = feedType === "feed" ? (useAI ? aiLoading : feedLoading) : mentionsLoading;
  const items = feedType === "feed" ? (useAI ? aiFeed : regularFeed) : mentions?.map((mention) => mention.twaat).filter(Boolean);

  useEffect(() => {
    if (feedType !== "feed") return;

    const channel = supabase
      .channel("twaater-feed-updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "twaats" },
        (payload) => {
          if (payload.new.account_id !== viewerAccountId) {
            setNewTwaatsCount((previous) => previous + 1);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [feedType, viewerAccountId]);

  const handleRefresh = () => {
    setNewTwaatsCount(0);
    if (useAI) refetchAI();
    else refetchRegular();
  };

  if (isLoading) return (
    <Card style={{ backgroundColor: "hsl(var(--twaater-card))" }}>
      <CardContent className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--twaater-purple))]" />
      </CardContent>
    </Card>
  );

  if (!items?.length) return (
    <Card style={{ backgroundColor: "hsl(var(--twaater-card))" }}>
      <CardContent className="py-12 text-center text-muted-foreground">
        No {feedType === "mentions" ? "mentions" : "twaats"} yet
      </CardContent>
    </Card>
  );

  // Keep the complete Twaat object. Older code rebuilt a legacy subset here,
  // which silently discarded media, quote hydration and promotion fields.
  const timelineTwaats = items.map((twaat: any) => ({
    ...twaat,
    account: {
      id: twaat.account?.id || twaat.twaater_accounts?.id,
      handle: twaat.account?.handle || twaat.twaater_accounts?.handle,
      display_name: twaat.account?.display_name || twaat.twaater_accounts?.display_name,
      verified: twaat.account?.verified || twaat.twaater_accounts?.verified || false,
      owner_type: twaat.account?.owner_type || twaat.twaater_accounts?.owner_type || "persona",
    },
    metrics: Array.isArray(twaat.metrics)
      ? twaat.metrics[0]
      : twaat.metrics || twaat.twaater_metrics?.[0] || { likes: 0, replies: 0, retwaats: 0, views: 0 },
  }));

  return (
    <div>
      {feedType === "feed" && (
        <div className="border-b p-3 flex items-center justify-between" style={{ borderColor: "hsl(var(--twaater-border))" }}>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[hsl(var(--twaater-purple))]" />
            {useAI ? "AI-Powered Feed" : "Chronological Feed"}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="text-[hsl(var(--twaater-purple))] hover:bg-[hsl(var(--twaater-purple)_/_0.1)]"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUseAI(!useAI)}
              className="text-[hsl(var(--twaater-purple))] hover:bg-[hsl(var(--twaater-purple)_/_0.1)]"
            >
              Switch to {useAI ? "Chronological" : "AI"}
            </Button>
          </div>
        </div>
      )}

      {newTwaatsCount > 0 && (
        <Button
          onClick={handleRefresh}
          className="w-full rounded-none bg-[hsl(var(--twaater-purple))] hover:bg-[hsl(var(--twaater-purple)_/_0.9)] text-white"
        >
          <ArrowUp className="h-4 w-4 mr-2" />
          {newTwaatsCount} new {newTwaatsCount === 1 ? "twaat" : "twaats"}
        </Button>
      )}

      <div className="p-2">
        <TwaaterTimeline
          twaats={timelineTwaats}
          currentAccountId={viewerAccountId}
          showDateSeparators={feedType === "feed"}
        />
      </div>
    </div>
  );
};
