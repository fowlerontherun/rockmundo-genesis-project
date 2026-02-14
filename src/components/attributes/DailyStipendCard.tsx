import { Gift, Calendar, Flame } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { claimDailyXp } from "@/utils/progression";
import { toast } from "sonner";
import { format } from "date-fns";
import { StreakProgressBar } from "./StreakProgressBar";
import { calculateTotalStipend, getStreakEmoji, getStreakMilestones } from "@/utils/dualXpSystem";
import { Badge } from "@/components/ui/badge";

interface DailyStipendCardProps {
  lastClaimDate?: string | null;
  streak?: number;
  lifetimeSxp?: number;
  onClaimed?: () => void;
}

export const DailyStipendCard = ({ lastClaimDate, streak = 0, lifetimeSxp = 0, onClaimed }: DailyStipendCardProps) => {
  const queryClient = useQueryClient();
  
  // Check if user has claimed today by comparing dates (not timestamps)
  const hasClaimedToday = lastClaimDate 
    ? format(new Date(lastClaimDate), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")
    : false;

  const claimMutation = useMutation({
    mutationFn: claimDailyXp,
    onSuccess: () => {
      toast.success("Daily stipend claimed successfully!");
      queryClient.invalidateQueries({ queryKey: ["gameData"] });
      onClaimed?.();
    },
    onError: (error: Error) => {
      // Don't show error toast if it's just the "already claimed" validation
      if (error.message?.includes("already claimed")) {
        toast.info("You've already claimed your daily stipend today");
      } else {
        toast.error(error.message || "Failed to claim daily stipend");
      }
    },
  });

  // Calculate what they'll get (use current streak + 1 if they claim today)
  const effectiveStreak = hasClaimedToday ? streak : streak + 1;
  const { baseSxp, baseAp, bonusSxp, bonusAp, totalSxp, totalAp } = calculateTotalStipend(
    hasClaimedToday ? streak : effectiveStreak,
    lifetimeSxp
  );

  const emoji = getStreakEmoji(streak);
  const milestones = getStreakMilestones(streak);
  const reachedMilestones = milestones.filter(m => m.reached);

  return (
    <Card className="border-accent/20 bg-accent/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-accent" />
            Daily Stipend
          </CardTitle>
          {streak > 0 && (
            <div className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-lg font-bold">{streak}</span>
              <span className="text-sm text-muted-foreground">day streak {emoji}</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Reward breakdown */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Base Reward:</span>
            <span>{baseSxp} SXP + {baseAp} AP</span>
          </div>
          
          {reachedMilestones.length > 0 && (
            <div className="space-y-1 border-t border-border/50 pt-2">
              {reachedMilestones.map((m) => (
                <div key={m.days} className="flex justify-between text-green-600 dark:text-green-400">
                  <span className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                      {m.label}
                    </Badge>
                    Bonus:
                  </span>
                  <span>+{m.bonusSxp} SXP + {m.bonusAp} AP</span>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex justify-between font-bold text-base border-t border-border pt-2">
            <span>Total Today:</span>
            <span className="text-primary">{totalSxp} SXP + {totalAp} AP</span>
          </div>
        </div>

        {/* Streak progress */}
        <StreakProgressBar streak={streak} />

        {/* Last claimed info */}
        {lastClaimDate && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>Last claimed: {format(new Date(lastClaimDate), "MMM d, yyyy")}</span>
          </div>
        )}
        
        <Button
          onClick={() => claimMutation.mutate({})}
          disabled={hasClaimedToday || claimMutation.isPending}
          className="w-full"
          size="lg"
        >
          {hasClaimedToday ? "Already Claimed Today" : "Claim Daily Stipend"}
        </Button>
      </CardContent>
    </Card>
  );
};
