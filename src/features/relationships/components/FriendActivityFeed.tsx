import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Gift, Handshake, Music2, Mic2, Sparkles, UsersRound, PartyPopper, GraduationCap } from "lucide-react";
import { useRelationshipFeed } from "@/hooks/useRelationshipFeed";
import { formatDistanceToNow } from "date-fns";
import { RELATIONSHIP_ACTION_REWARDS } from "../rewardsConfig";

const ACTION_ICONS: Record<string, typeof Gift> = {
  chat: PartyPopper,
  gift: Gift,
  hangout: UsersRound,
  trade: Handshake,
  jam: Music2,
  gig: Mic2,
  songwriting: Sparkles,
  teach: GraduationCap,
  learn: GraduationCap,
};

export function FriendActivityFeed() {
  const { data, isLoading } = useRelationshipFeed(15);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" />
          Recent friend rewards
        </CardTitle>
        <CardDescription className="text-xs">
          Your latest XP-earning interactions across all friends.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
        ) : !data || data.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No interactions yet. Tap any quick action on a friend to start earning XP.
          </p>
        ) : (
          data.map((item) => {
            const Icon = ACTION_ICONS[item.action_type] ?? Activity;
            const cfg = RELATIONSHIP_ACTION_REWARDS[item.action_type];
            const name = item.other_display_name ?? item.other_username ?? "Friend";
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-md border bg-card/50 p-2.5 text-sm"
              >
                <div className="rounded-full bg-primary/10 p-1.5">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-medium">
                    {cfg?.label ?? item.action_type} · {name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="text-right text-[11px]">
                  <p className="font-semibold text-primary">+{item.xp_awarded} XP</p>
                  {item.skill_xp_awarded > 0 && (
                    <p className="text-muted-foreground">
                      +{item.skill_xp_awarded} {cfg?.skillLabel ?? "Skill"}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
