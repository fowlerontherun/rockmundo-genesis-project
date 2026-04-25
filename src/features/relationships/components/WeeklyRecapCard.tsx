import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Trophy, Activity, Users } from "lucide-react";
import { useWeeklyRelationshipRecap } from "@/hooks/useRelationshipInsights";
import { RELATIONSHIP_ACTION_REWARDS } from "@/features/relationships/rewardsConfig";

export function WeeklyRecapCard() {
  const { data, isLoading } = useWeeklyRelationshipRecap();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Weekly Social Recap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const recap = data;
  const hasActivity = (recap?.interactions ?? 0) > 0;
  const topActionLabel = recap?.topActionType
    ? RELATIONSHIP_ACTION_REWARDS[recap.topActionType]?.label ?? recap.topActionType
    : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" /> Weekly Social Recap
        </CardTitle>
        <CardDescription className="text-xs">Last 7 days of relationship activity</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasActivity ? (
          <p className="text-sm text-muted-foreground">
            No social interactions in the past week. Use quick actions on a friend to start earning XP.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border bg-card p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total XP</p>
                <p className="text-lg font-bold text-primary">+{recap!.totalXp}</p>
              </div>
              <div className="rounded-lg border bg-card p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Skill XP</p>
                <p className="text-lg font-bold text-social-chemistry">+{recap!.totalSkillXp}</p>
              </div>
              <div className="rounded-lg border bg-card p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <Activity className="h-3 w-3" /> Interactions
                </p>
                <p className="text-lg font-bold">{recap!.interactions}</p>
              </div>
              <div className="rounded-lg border bg-card p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" /> Friends
                </p>
                <p className="text-lg font-bold">{recap!.uniqueFriends}</p>
              </div>
            </div>

            {recap!.topFriendName && (
              <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-2.5">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Top friend this week</p>
                    <p className="text-sm font-semibold">{recap!.topFriendName}</p>
                  </div>
                </div>
                <Badge variant="secondary">+{recap!.topFriendXp} XP</Badge>
              </div>
            )}

            {topActionLabel && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Most used action</span>
                <Badge variant="outline">{topActionLabel} × {recap!.topActionCount}</Badge>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
