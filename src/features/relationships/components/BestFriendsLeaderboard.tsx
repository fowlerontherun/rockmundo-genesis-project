import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Crown, Trophy, Medal } from "lucide-react";
import { useBestFriends } from "@/hooks/useRelationshipFeed";

const TIER_LABELS: Record<string, { label: string; className: string }> = {
  "legendary-duo": { label: "Legendary Duo", className: "bg-primary/20 text-primary border-primary/40" },
  "inner-circle": { label: "Inner Circle", className: "bg-accent/20 text-accent-foreground border-accent/40" },
  "bandmate": { label: "Bandmate", className: "bg-secondary text-secondary-foreground border-border" },
  "acquaintance": { label: "Acquaintance", className: "bg-muted text-muted-foreground border-border" },
};

const RANK_ICONS = [Crown, Trophy, Medal];

export function BestFriendsLeaderboard() {
  const { data, isLoading } = useBestFriends(5);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Crown className="h-4 w-4 text-primary" />
          Best friends
        </CardTitle>
        <CardDescription className="text-xs">
          Top friendships by lifetime XP earned together.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
        ) : !data || data.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Earn XP with friends to climb this leaderboard.
          </p>
        ) : (
          data.map((item, idx) => {
            const RankIcon = RANK_ICONS[idx];
            const tier = TIER_LABELS[item.tier] ?? TIER_LABELS["acquaintance"];
            const name = item.other_display_name ?? item.other_username ?? "Friend";
            return (
              <div
                key={item.other_profile_id}
                className="flex items-center gap-3 rounded-md border bg-card/50 p-2.5"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  {RankIcon ? (
                    <RankIcon className="h-4 w-4 text-primary" />
                  ) : (
                    <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${tier.className}`}>
                      {tier.label}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {item.interaction_count} interactions
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-primary">{item.lifetime_xp.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">lifetime XP</p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
