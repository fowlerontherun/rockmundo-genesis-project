import { Card, CardContent } from "@/components/ui/card";
import { Flame, Trophy } from "lucide-react";
import { useSocialStreak } from "@/hooks/useRelationshipRewards";
import { STREAK_TIERS } from "../rewardsConfig";

export function StreakBanner() {
  const { data } = useSocialStreak();
  const streak = data?.current_streak ?? 0;

  // Find next milestone
  const nextMilestone = STREAK_TIERS.find((t) => t.day > streak);
  const currentMilestone = [...STREAK_TIERS].reverse().find((t) => t.day <= streak);

  return (
    <Card className="border-primary/30 bg-gradient-to-r from-primary/10 via-background to-background">
      <CardContent className="flex flex-wrap items-center gap-4 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/20 p-2.5">
            <Flame className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-semibold leading-tight">{streak}-day streak</p>
            <p className="text-xs text-muted-foreground">
              Interact with any friend each day to keep it alive.
            </p>
          </div>
        </div>

        {currentMilestone && (
          <div className="flex items-center gap-2 rounded-md bg-background/60 px-3 py-1.5 text-xs">
            <Trophy className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium">Active bonus:</span>
            <span>+{currentMilestone.xp} XP{currentMilestone.skillXp ? ` · +${currentMilestone.skillXp} Charisma` : ""} per day</span>
          </div>
        )}

        {nextMilestone && (
          <div className="ml-auto text-right text-xs text-muted-foreground">
            <p>Next: <span className="font-medium text-foreground">Day {nextMilestone.day}</span></p>
            <p>+{nextMilestone.xp} XP{nextMilestone.skillXp ? ` · +${nextMilestone.skillXp} Charisma` : ""}</p>
          </div>
        )}

        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>Best: {data?.longest_streak ?? 0}d</span>
          <span>·</span>
          <span>Total: {data?.total_days ?? 0}d</span>
        </div>
      </CardContent>
    </Card>
  );
}
