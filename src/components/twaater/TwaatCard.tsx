import { formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTwaaterReactions } from "@/hooks/useTwaaterReactions";
import { useTwaaterModeration } from "@/hooks/useTwaaterModeration";
import { useTwaaterFollow } from "@/hooks/useTwaaterFollow";
import { TwaatReplyDialog } from "./TwaatReplyDialog";
import { TwaatReportDialog } from "./TwaatReportDialog";
import { Heart, Repeat2, BarChart2, BadgeCheck, MoreHorizontal, Ban, UserPlus, Check } from "lucide-react";

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
  const { blockAccount, isBlocking, isAccountBlocked } = useTwaaterModeration(viewerAccountId);
  const { isFollowing, follow, unfollow, isFollowPending } = useTwaaterFollow(viewerAccountId);

  const handleLike = () => {
    toggleLike({ twaatId: twaat.id, accountId: viewerAccountId });
  };

  const handleRetwaat = () => {
    toggleRetwaat({ twaatId: twaat.id, accountId: viewerAccountId });
  };

  const handleBlock = () => {
    if (confirm(`Block @${twaat.account.handle}? You won't see their posts anymore.`)) {
      blockAccount({
        blockerAccountId: viewerAccountId,
        blockedAccountId: twaat.account.id,
      });
    }
  };

  const handleFollowClick = () => {
    if (following) {
      unfollow({ followedAccountId: twaat.account.id });
    } else {
      follow({ followedAccountId: twaat.account.id });
    }
  };

  const isOwnPost = twaat.account.id === viewerAccountId;
  const isBlocked = isAccountBlocked(twaat.account.id);
  const following = isFollowing(twaat.account.id);

  return (
    <div className="border-b px-4 py-3 hover:bg-[hsl(var(--twaater-hover))] transition-colors cursor-pointer" style={{ borderColor: 'hsl(var(--twaater-border))' }}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[hsl(var(--twaater-purple))] to-[hsl(var(--primary))] flex items-center justify-center text-white font-bold">
            {twaat.account.display_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
                <span className="font-bold hover:underline truncate">{twaat.account.display_name}</span>
                {twaat.account.verified && (
                  <BadgeCheck className="h-4 w-4 flex-shrink-0" style={{ color: 'hsl(var(--twaater-purple))' }} />
                )}
                <span className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  @{twaat.account.handle} · {formatDistanceToNow(new Date(twaat.created_at), { addSuffix: true })}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {!isOwnPost && (
                  <Button
                    size="sm"
                    variant={following ? "secondary" : "default"}
                    onClick={handleFollowClick}
                    disabled={isFollowPending}
                    className="h-7"
                  >
                    {following ? (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        Following
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-3 w-3 mr-1" />
                        Follow
                      </>
                    )}
                  </Button>
                )}

                {!isOwnPost && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!isBlocked && (
                        <>
                          <TwaatReportDialog
                            twaatId={twaat.id}
                            accountId={twaat.account.id}
                            viewerAccountId={viewerAccountId}
                            asMenuItem={true}
                          />
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem onClick={handleBlock} disabled={isBlocking} className="text-destructive">
                        <Ban className="h-4 w-4 mr-2" />
                        {isBlocked ? "Blocked" : "Block @" + twaat.account.handle}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>

            {/* Body */}
            <p className="mt-1 whitespace-pre-wrap break-words">{twaat.body}</p>

            {/* Badges */}
            {(twaat.linked_type || twaat.outcome_code) && (
              <div className="flex flex-wrap gap-2 mt-2">
                {twaat.linked_type && (
                  <Badge variant="secondary" className="text-xs capitalize" style={{ backgroundColor: 'hsl(var(--twaater-purple) / 0.2)', color: 'hsl(var(--twaater-purple))' }}>
                    {twaat.linked_type}
                  </Badge>
                )}
                {twaat.outcome_code && (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <BarChart2 className="h-3 w-3" />
                    {twaat.outcome_code}
                  </Badge>
                )}
              </div>
            )}

            {/* Campaign Metrics */}
            {(twaat.metrics.rsvps > 0 || twaat.metrics.sales > 0 || twaat.metrics.clicks > 0) && (
              <div className="flex flex-wrap gap-3 mt-2 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                {twaat.metrics.rsvps > 0 && (
                  <span><span className="font-bold">{twaat.metrics.rsvps}</span> RSVPs</span>
                )}
                {twaat.metrics.sales > 0 && (
                  <span><span className="font-bold">{twaat.metrics.sales}</span> sales</span>
                )}
                {twaat.metrics.clicks > 0 && (
                  <span><span className="font-bold">{twaat.metrics.clicks}</span> clicks</span>
                )}
              </div>
            )}

            {/* Metrics */}
            <div className="flex items-center justify-between max-w-md mt-3">
              <TwaatReplyDialog
                twaatId={twaat.id}
                accountId={viewerAccountId}
                replyCount={twaat.metrics.replies}
              />

              <Button
                variant="ghost"
                size="sm"
                onClick={handleRetwaat}
                className="gap-1 h-8 px-2 hover:text-[hsl(var(--success))] hover:bg-[hsl(var(--success)_/_0.1)]"
                style={{ color: 'hsl(var(--muted-foreground))' }}
              >
                <Repeat2 className="h-4 w-4" />
                {twaat.metrics.retwaats > 0 && <span className="text-xs">{twaat.metrics.retwaats}</span>}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLike}
                className="gap-1 h-8 px-2 hover:text-red-500 hover:bg-red-500/10"
                style={{ color: 'hsl(var(--muted-foreground))' }}
              >
                <Heart className="h-4 w-4" />
                {twaat.metrics.likes > 0 && <span className="text-xs">{twaat.metrics.likes}</span>}
              </Button>

              {twaat.metrics.impressions > 0 && (
                <div className="text-xs ml-auto" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  {twaat.metrics.impressions.toLocaleString()} views
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
