import { formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTwaaterReactions } from "@/hooks/useTwaaterReactions";
import { TwaatReplyDialog } from "./TwaatReplyDialog";
import { Heart, Repeat2, BarChart2, BadgeCheck } from "lucide-react";

interface TwaatCardProps {
  twaat: {
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
  };
  viewerAccountId: string;
}

export const TwaatCard = ({ twaat, viewerAccountId }: TwaatCardProps) => {
  const { toggleLike, toggleRetwaat } = useTwaaterReactions();

  const handleLike = () => {
    toggleLike({ twaatId: twaat.id, accountId: viewerAccountId });
  };

  const handleRetwaat = () => {
    toggleRetwaat({ twaatId: twaat.id, accountId: viewerAccountId });
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div>
              <div className="flex items-center gap-1">
                <span className="font-semibold">{twaat.account.display_name}</span>
                {twaat.account.verified && (
                  <BadgeCheck className="h-4 w-4 text-primary fill-primary" />
                )}
                <Badge variant="outline" className="ml-1">
                  {twaat.account.owner_type}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                @{twaat.account.handle} • {formatDistanceToNow(new Date(twaat.created_at), { addSuffix: true })}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <p className="text-foreground whitespace-pre-wrap">{twaat.body}</p>

        {/* Linked Content Badge */}
        {twaat.linked_type && (
          <Badge variant="secondary" className="capitalize">
            {twaat.linked_type} Campaign
          </Badge>
        )}

        {/* Outcome Badge */}
        {twaat.outcome_code && (
          <Badge variant="outline" className="gap-1">
            <BarChart2 className="h-3 w-3" />
            Outcome: {twaat.outcome_code}
          </Badge>
        )}

        {/* Metrics */}
        <div className="flex items-center gap-6 pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLike}
            className="gap-2 text-muted-foreground hover:text-primary"
          >
            <Heart className="h-4 w-4" />
            {twaat.metrics.likes > 0 && twaat.metrics.likes}
          </Button>

          <TwaatReplyDialog
            twaatId={twaat.id}
            accountId={viewerAccountId}
            replyCount={twaat.metrics.replies}
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRetwaat}
            className="gap-2 text-muted-foreground hover:text-primary"
          >
            <Repeat2 className="h-4 w-4" />
            {twaat.metrics.retwaats > 0 && twaat.metrics.retwaats}
          </Button>

          {twaat.metrics.impressions > 0 && (
            <div className="ml-auto text-sm text-muted-foreground">
              {twaat.metrics.impressions.toLocaleString()} views
            </div>
          )}
        </div>

        {/* Campaign Metrics */}
        {(twaat.metrics.rsvps > 0 || twaat.metrics.sales > 0 || twaat.metrics.clicks > 0) && (
          <div className="flex gap-4 pt-2 border-t text-sm">
            {twaat.metrics.rsvps > 0 && (
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{twaat.metrics.rsvps}</span> RSVPs
              </span>
            )}
            {twaat.metrics.sales > 0 && (
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{twaat.metrics.sales}</span> sales
              </span>
            )}
            {twaat.metrics.clicks > 0 && (
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{twaat.metrics.clicks}</span> clicks
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
