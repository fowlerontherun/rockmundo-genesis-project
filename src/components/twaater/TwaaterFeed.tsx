import { useTwaaterFeed } from "@/hooks/useTwaats";
import { useTwaaterAIFeed } from "@/hooks/useTwaaterAIFeed";
import { useTwaaterMentions } from "@/hooks/useTwaaterMentions";
import { TwaatCard } from "./TwaatCard";
import { Loader2, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface TwaaterFeedProps {
  viewerAccountId?: string;
  feedType?: "feed" | "mentions";
}

export const TwaaterFeed = ({ viewerAccountId, feedType = "feed" }: TwaaterFeedProps) => {
  const [useAI, setUseAI] = useState(true);
  
  const { feed: regularFeed, isLoading: feedLoading } = useTwaaterFeed(feedType === "feed" ? viewerAccountId : undefined);
  const { data: aiFeed, isLoading: aiLoading } = useTwaaterAIFeed(useAI && feedType === "feed" ? viewerAccountId : undefined);
  const { mentions, isLoading: mentionsLoading } = useTwaaterMentions(feedType === "mentions" ? viewerAccountId : undefined);

  const isLoading = feedType === "feed" ? (useAI ? aiLoading : feedLoading) : mentionsLoading;
  const items = feedType === "feed" ? (useAI ? aiFeed : regularFeed) : mentions?.map(m => m.twaat).filter(Boolean);

  if (isLoading) return <Card><CardContent className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>;
  if (!items?.length) return <Card><CardContent className="py-12 text-center text-muted-foreground">No {feedType === "mentions" ? "mentions" : "twaats"} yet</CardContent></Card>;

  return (
    <div>
      {feedType === "feed" && (
        <div className="border-b p-3 flex items-center justify-between" style={{ borderColor: 'hsl(var(--twaater-border))' }}>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {useAI ? "AI-Powered Feed" : "Chronological Feed"}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setUseAI(!useAI)}
          >
            Switch to {useAI ? "Chronological" : "AI"}</Button>
        </div>
      )}
      <div>
        {items.map((twaat: any) => twaat && <TwaatCard key={twaat.id} twaat={twaat} viewerAccountId={viewerAccountId || ""} />)}
      </div>
    </div>
  );
};
