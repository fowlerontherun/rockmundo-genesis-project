import { getNextMilestone, getStreakEmoji, STREAK_MILESTONES } from "@/utils/dualXpSystem";
import { Progress } from "@/components/ui/progress";

interface StreakProgressBarProps {
  streak: number;
}

export const StreakProgressBar = ({ streak }: StreakProgressBarProps) => {
  const nextMilestone = getNextMilestone(streak);
  const emoji = getStreakEmoji(streak);
  
  if (!nextMilestone) {
    // Max streak achieved
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-lg">{emoji}</span>
        <span className="text-primary font-medium">Maximum streak achieved!</span>
      </div>
    );
  }

  // Calculate progress toward next milestone
  const previousMilestone = STREAK_MILESTONES.filter(m => m < nextMilestone.days).pop() ?? 0;
  const progressInSegment = streak - previousMilestone;
  const segmentSize = nextMilestone.days - previousMilestone;
  const progressPercent = (progressInSegment / segmentSize) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-base">{emoji}</span>
          <span className="text-muted-foreground">Day {streak}</span>
        </div>
        <span className="text-muted-foreground">
          {nextMilestone.daysRemaining} days to {nextMilestone.label}
        </span>
      </div>
      <Progress value={progressPercent} className="h-2" />
    </div>
  );
};
