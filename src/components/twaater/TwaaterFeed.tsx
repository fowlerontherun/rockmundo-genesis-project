import { Card, CardContent } from "@/components/ui/card";
import { TwaatCard } from "./TwaatCard";
import { Loader2 } from "lucide-react";

interface TwaatWithDetails {
  id: string;
  body: string;
  created_at: string;
  linked_type: string | null;
  outcome_code: string | null;
  account: {
    id: string;
    handle: string;
    display_name: string;
    verified: boolean;
    owner_type: string;
  };
  metrics: {
    likes: number;
    replies: number;
    retwaats: number;
    impressions: number;
    clicks: number;
    rsvps: number;
    sales: number;
  };
}

interface TwaaterFeedProps {
  feed: TwaatWithDetails[];
  isLoading: boolean;
  viewerAccountId: string;
}

export const TwaaterFeed = ({ feed, isLoading, viewerAccountId }: TwaaterFeedProps) => {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!feed || feed.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">No twaats yet</p>
            <p className="text-sm text-muted-foreground">
              Start posting or follow other artists to see content here!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {feed.map((twaat) => (
        <TwaatCard
          key={twaat.id}
          twaat={twaat}
          viewerAccountId={viewerAccountId}
        />
      ))}
    </div>
  );
};
