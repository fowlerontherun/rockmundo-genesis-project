import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Users, Check, UserPlus } from "lucide-react";
import { useTwaaterFollow } from "@/hooks/useTwaaterFollow";

interface TwaaterAccountCardProps {
  account: {
    id: string;
    handle: string;
    display_name: string;
    owner_type: string;
    verified: boolean;
    fame_score: number | null;
    follower_count: number | null;
  };
  currentAccountId: string;
}

export const TwaaterAccountCard = ({ account, currentAccountId }: TwaaterAccountCardProps) => {
  const { isFollowing, follow, unfollow, isFollowPending } = useTwaaterFollow(currentAccountId);
  const following = isFollowing(account.id);

  const handleFollowClick = () => {
    if (following) {
      unfollow({ followedAccountId: account.id });
    } else {
      follow({ followedAccountId: account.id });
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex-shrink-0">
          {account.owner_type === "persona" ? (
            <User className="h-10 w-10 text-muted-foreground" />
          ) : (
            <Users className="h-10 w-10 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">{account.display_name}</span>
            {account.verified && (
              <Badge variant="secondary" className="text-xs">✓</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">@{account.handle}</p>
          <p className="text-xs text-muted-foreground">
            {account.follower_count?.toLocaleString() || 0} followers
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant={following ? "secondary" : "default"}
        onClick={handleFollowClick}
        disabled={isFollowPending}
        className="flex-shrink-0"
      >
        {following ? (
          <>
            <Check className="h-4 w-4 mr-1" />
            Following
          </>
        ) : (
          <>
            <UserPlus className="h-4 w-4 mr-1" />
            Follow
          </>
        )}
      </Button>
    </div>
  );
};
