import { useTwaaterExploreFeed } from "@/hooks/useTwaaterExploreFeed";
import TwaaterTimeline from "./TwaaterTimeline";
import { Loader2, Compass, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface TwaaterExploreFeedProps {
  viewerAccountId?: string;
}

export const TwaaterExploreFeed = ({ viewerAccountId }: TwaaterExploreFeedProps) => {
  const { data: exploreFeed, isLoading, refetch, isFetching } = useTwaaterExploreFeed(viewerAccountId);

  if (isLoading) {
    return (
      <Card style={{ backgroundColor: "hsl(var(--twaater-card))" }}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--twaater-purple))]" />
        </CardContent>
      </Card>
    );
  }

  if (!exploreFeed?.length) {
    return (
      <Card style={{ backgroundColor: "hsl(var(--twaater-card))" }}>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Compass className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p>No posts to explore yet</p>
          <p className="text-sm mt-1">Check back soon for new content!</p>
        </CardContent>
      </Card>
    );
  }

  // Transform to timeline format
  const timelineTwaats = exploreFeed.map((twaat) => ({
    id: twaat.id,
    body: twaat.body,
    created_at: twaat.created_at,
    linked_type: twaat.linked_type,
    linked_id: twaat.linked_id,
    parent_twaat_id: twaat.parent_twaat_id,
    quoted_twaat_id: twaat.quoted_twaat_id,
    account: {
      id: twaat.account?.id,
      handle: twaat.account?.handle,
      display_name: twaat.account?.display_name,
      verified: twaat.account?.verified || false,
      owner_type: twaat.account?.owner_type || "persona",
    },
    metrics: twaat.metrics || { likes: 0, replies: 0, retwaats: 0, views: 0 },
  }));

  return (
    <div>
      <div className="border-b p-3 flex items-center justify-between" style={{ borderColor: 'hsl(var(--twaater-border))' }}>
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Compass className="h-4 w-4 text-[hsl(var(--twaater-purple))]" />
          Discover trending posts
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-[hsl(var(--twaater-purple))] hover:bg-[hsl(var(--twaater-purple)_/_0.1)]"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      <div className="p-2">
        <TwaaterTimeline 
          twaats={timelineTwaats} 
          currentAccountId={viewerAccountId}
          showDateSeparators={true}
        />
      </div>
    </div>
  );
};
