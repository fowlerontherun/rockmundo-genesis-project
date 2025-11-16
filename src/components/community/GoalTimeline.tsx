import { format, formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckCircle2, CircleDot, MessageSquareText, Sparkle } from "lucide-react";
import type { GoalCheckIn, MentorshipGoalStatus } from "./types";

const SENTIMENT_BADGE: Record<string, { variant: "default" | "secondary" | "destructive"; label: string }> = {
  positive: { variant: "default", label: "On track" },
  neutral: { variant: "secondary", label: "Steady" },
  negative: { variant: "destructive", label: "Needs support" },
};

const STATUS_ICON: Record<MentorshipGoalStatus, typeof CheckCircle2> = {
  not_started: CircleDot,
  in_progress: MessageSquareText,
  completed: CheckCircle2,
  blocked: Sparkle,
};

interface GoalTimelineProps {
  goalTitle: string;
  status: MentorshipGoalStatus;
  checkIns: GoalCheckIn[];
  supportNotes?: string | null;
}

export function GoalTimeline({ goalTitle, status, checkIns, supportNotes }: GoalTimelineProps) {
  const Icon = STATUS_ICON[status];

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{goalTitle}</CardTitle>
            <p className="text-sm text-muted-foreground">Milestones and check-ins</p>
          </div>
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="flex h-[420px] flex-col gap-4">
        {supportNotes && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="font-medium text-foreground">Support plan</p>
            <p className="text-muted-foreground">{supportNotes}</p>
          </div>
        )}
        <ScrollArea className="h-full pr-3">
          <div className="relative space-y-4 border-l pl-4">
            {checkIns.length === 0 && (
              <p className="text-sm text-muted-foreground">No check-ins recorded yet. Start the first milestone to kick things off.</p>
            )}
            {checkIns.map((checkIn, index) => {
              const sentiment = checkIn.sentiment ? SENTIMENT_BADGE[checkIn.sentiment] : null;
              return (
                <div key={checkIn.id} className="relative pl-6">
                  <span className="absolute left-[-11px] top-1 flex h-5 w-5 items-center justify-center rounded-full border bg-background">
                    <Icon className={cn("h-3 w-3", index === checkIns.length - 1 && "text-primary")} />
                  </span>
                  <div className="space-y-1 rounded-md border bg-background/80 p-3 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{format(new Date(checkIn.timestamp), "MMM d, yyyy • h:mm a")}</span>
                      <span>{formatDistanceToNow(new Date(checkIn.timestamp), { addSuffix: true })}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">Progress at {Math.round(checkIn.progress)}%</p>
                      {sentiment && <Badge variant={sentiment.variant}>{sentiment.label}</Badge>}
                    </div>
                    {checkIn.note && <p className="text-sm text-muted-foreground">{checkIn.note}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
