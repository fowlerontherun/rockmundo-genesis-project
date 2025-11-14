import { format, formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Target, CalendarDays, TrendingUp } from "lucide-react";
import type { MentorshipGoal } from "./types";

const STATUS_META: Record<MentorshipGoal["status"], { label: string; badgeVariant: "default" | "secondary" | "destructive" | "outline"; description: string; accent: string }>
  = {
    not_started: {
      label: "Not started",
      badgeVariant: "secondary",
      description: "Kick-off pending",
      accent: "border-dashed",
    },
    in_progress: {
      label: "In progress",
      badgeVariant: "default",
      description: "Momentum building",
      accent: "border-primary/40",
    },
    completed: {
      label: "Completed",
      badgeVariant: "outline",
      description: "Milestone achieved",
      accent: "border-emerald-500/50",
    },
    blocked: {
      label: "Blocked",
      badgeVariant: "destructive",
      description: "Needs support",
      accent: "border-destructive/50",
    },
  };

interface GoalProgressCardProps {
  goal: MentorshipGoal;
  isSelected?: boolean;
  onSelect?: (goalId: string) => void;
}

export function GoalProgressCard({ goal, isSelected = false, onSelect }: GoalProgressCardProps) {
  const meta = STATUS_META[goal.status];
  const lastTouchpoint = goal.lastCheckIn
    ? formatDistanceToNow(new Date(goal.lastCheckIn), { addSuffix: true })
    : "Awaiting first sync";

  const targetLabel = goal.targetDate ? format(new Date(goal.targetDate), "MMM d, yyyy") : "Flexible";

  const handleSelect = () => {
    if (onSelect) {
      onSelect(goal.id);
    }
  };

  const metrics = goal.metrics ? Object.entries(goal.metrics).slice(0, 3) : [];
  const focusAreas = goal.focusAreas ?? [];

  return (
    <Card
      role={onSelect ? "button" : undefined}
      onClick={handleSelect}
      className={cn(
        "flex h-full cursor-pointer flex-col border transition hover:border-primary/50",
        isSelected && "ring-2 ring-primary",
        meta.accent,
      )}
    >
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg font-semibold leading-tight">{goal.title}</CardTitle>
          <Badge variant={meta.badgeVariant}>{meta.label}</Badge>
        </div>
        {goal.description && (
          <CardDescription className="line-clamp-2 text-sm">{goal.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm font-medium">
            <span>Progress</span>
            <span>{goal.progress}%</span>
          </div>
          <Progress value={goal.progress} className="h-2.5" />
        </div>

        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <div>
              <p className="font-medium text-foreground">Target</p>
              <p>{targetLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <div>
              <p className="font-medium text-foreground">Last check-in</p>
              <p>{lastTouchpoint}</p>
            </div>
          </div>
        </div>

        {focusAreas.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {focusAreas.map((area) => (
              <Badge key={area} variant="outline" className="capitalize">
                <Target className="mr-1 h-3 w-3" />
                {area}
              </Badge>
            ))}
          </div>
        )}

        {metrics.length > 0 && (
          <div className="space-y-1 text-xs">
            <p className="font-medium text-foreground">Key signals</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {metrics.map(([key, value]) => (
                <div key={key} className="rounded-md border bg-muted/30 px-2 py-2">
                  <p className="font-medium capitalize text-foreground">{key.replace(/_/g, " ")}</p>
                  <p>{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
