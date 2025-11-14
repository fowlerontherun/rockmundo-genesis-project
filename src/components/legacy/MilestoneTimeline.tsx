import { LegacyMilestone } from "@/lib/api/legacy";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CheckCircle2, CircleDashed, Clock, Flag } from "lucide-react";

interface MilestoneTimelineProps {
  milestones: LegacyMilestone[];
}

const formatDate = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed);
};

export function MilestoneTimeline({ milestones }: MilestoneTimelineProps) {
  if (!milestones.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Your legacy timeline is waiting to be written. Start completing goals to see them here.
        </CardContent>
      </Card>
    );
  }

  return (
    <ol className="relative space-y-6 border-l border-border pl-6">
      {milestones.map((milestone, index) => {
        const isAchieved = Boolean(milestone.isAchieved || milestone.achievedAt);
        const achievedDate = formatDate(milestone.achievedAt);
        const targetDate = formatDate(milestone.targetDate);
        const isLast = index === milestones.length - 1;

        return (
          <li key={milestone.id} className={cn("relative", !isLast && "pb-6")}>
            <span
              className={cn(
                "absolute -left-3 top-1 flex h-6 w-6 items-center justify-center rounded-full border bg-background",
                isAchieved ? "border-primary text-primary" : "border-muted-foreground/40 text-muted-foreground"
              )}
            >
              {isAchieved ? <CheckCircle2 className="h-4 w-4" /> : <CircleDashed className="h-4 w-4" />}
            </span>

            <div className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold leading-none">{milestone.title}</h3>
                    <Badge variant="outline" className="text-xs capitalize">
                      {milestone.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{milestone.description}</p>
                </div>
                <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                  {achievedDate ? (
                    <span className="flex items-center gap-1 font-medium text-emerald-600">
                      <Flag className="h-3.5 w-3.5" />
                      Reached {achievedDate}
                    </span>
                  ) : targetDate ? (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      Target {targetDate}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      Active goal
                    </span>
                  )}
                  <Badge variant={isAchieved ? "default" : "secondary"}>
                    {isAchieved ? "Achieved" : "In progress"}
                  </Badge>
                </div>
              </div>

              {milestone.highlight && (
                <div className="rounded-md bg-muted/60 p-3 text-sm text-muted-foreground">
                  “{milestone.highlight}”
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default MilestoneTimeline;
