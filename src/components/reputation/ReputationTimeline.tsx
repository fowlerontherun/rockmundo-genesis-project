import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReputationSentiment } from "@/lib/api/reputation";
import { CalendarClock, TrendingDown, TrendingUp } from "lucide-react";

export interface ReputationTimelineMetric {
  label: string;
  value: string;
  tone?: ReputationSentiment;
}

export interface ReputationTimelineEvent {
  id: string;
  date: string;
  title: string;
  description?: string;
  channel?: string;
  owner?: string;
  sentiment: ReputationSentiment;
  delta: number;
  metrics?: ReputationTimelineMetric[];
  tags?: string[];
  followUp?: string;
}

export interface ReputationTimelineProps {
  events: ReputationTimelineEvent[];
  className?: string;
  emptyState?: React.ReactNode;
}

const sentimentBorderStyles: Record<ReputationSentiment, string> = {
  positive: "border-emerald-500/70",
  neutral: "border-blue-500/70",
  negative: "border-red-500/70",
};

const sentimentBackgroundStyles: Record<ReputationSentiment, string> = {
  positive: "bg-emerald-500/5",
  neutral: "bg-blue-500/5",
  negative: "bg-red-500/5",
};

const badgeToneStyles: Record<ReputationSentiment, string> = {
  positive: "border-transparent bg-emerald-500/10 text-emerald-600",
  neutral: "border-transparent bg-blue-500/10 text-blue-600",
  negative: "border-transparent bg-red-500/10 text-red-600",
};

const metricToneTextStyles: Record<ReputationSentiment, string> = {
  positive: "text-emerald-600",
  neutral: "text-blue-600",
  negative: "text-red-600",
};

const formatDate = (isoDate: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(isoDate));
  } catch (error) {
    return isoDate;
  }
};

const formatDelta = (delta: number) => `${delta > 0 ? "+" : ""}${delta}`;

export const ReputationTimeline = ({
  events,
  className,
  emptyState = (
    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      No reputation events logged yet. Launch a media initiative to start tracking impact.
    </div>
  ),
}: ReputationTimelineProps) => {
  if (!events.length) {
    return <div className={cn("pl-2", className)}>{emptyState}</div>;
  }

  return (
    <div className={cn("space-y-6", className)}>
      {events.map((event, index) => {
        const isLast = index === events.length - 1;
        const deltaIsPositive = event.delta >= 0;
        const DeltaIcon = deltaIsPositive ? TrendingUp : TrendingDown;

        return (
          <div key={event.id} className="flex gap-4">
            <div className="flex w-6 flex-col items-center">
              <span
                className={cn(
                  "mt-2 flex h-3 w-3 items-center justify-center rounded-full border",
                  event.sentiment === "positive" && "border-emerald-500/60 bg-emerald-500",
                  event.sentiment === "neutral" && "border-blue-500/60 bg-blue-500",
                  event.sentiment === "negative" && "border-red-500/60 bg-red-500",
                )}
              />
              {!isLast && <span className="mt-2 h-full w-px bg-border" aria-hidden="true" />}
            </div>
            <Card
              className={cn(
                "flex-1 border-l-4",
                sentimentBorderStyles[event.sentiment],
                sentimentBackgroundStyles[event.sentiment],
              )}
            >
              <CardContent className="space-y-4 pt-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarClock className="h-3.5 w-3.5" />
                      <span>{formatDate(event.date)}</span>
                      {event.channel ? (
                        <>
                          <span aria-hidden="true">•</span>
                          <span className="font-medium text-foreground">{event.channel}</span>
                        </>
                      ) : null}
                    </div>
                    <p className="text-base font-semibold text-foreground">{event.title}</p>
                    {event.description ? (
                      <p className="max-w-2xl text-sm text-muted-foreground">{event.description}</p>
                    ) : null}
                    {event.followUp ? (
                      <p className="text-xs text-muted-foreground">Next step: {event.followUp}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-sm font-medium">
                    <DeltaIcon className={cn("h-4 w-4", deltaIsPositive ? "text-emerald-500" : "text-red-500")} />
                    <span>{formatDelta(event.delta)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {event.owner ? <Badge variant="outline">Owner: {event.owner}</Badge> : null}
                  <Badge variant="outline" className={cn("border-transparent", badgeToneStyles[event.sentiment])}>
                    {event.sentiment === "positive"
                      ? "Positive sentiment"
                      : event.sentiment === "negative"
                        ? "Negative sentiment"
                        : "Neutral sentiment"}
                  </Badge>
                  {event.tags?.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>

                {event.metrics?.length ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {event.metrics.map((metric) => (
                      <div key={metric.label} className="rounded-lg border border-border/40 bg-background/60 p-3">
                        <p className="text-xs text-muted-foreground">{metric.label}</p>
                        <p
                          className={cn(
                            "mt-1 text-sm font-semibold text-foreground",
                            metric.tone ? metricToneTextStyles[metric.tone] : undefined,
                          )}
                        >
                          {metric.value}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
};

export default ReputationTimeline;
