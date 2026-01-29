// Reputation Events List - Shows recent reputation changes
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useReputationEvents } from "@/hooks/useReputation";
import { REPUTATION_AXES, type ReputationAxis } from "@/types/roleplaying";
import { formatDistanceToNow } from "date-fns";
import { TrendingUp, TrendingDown, Minus, History } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReputationEventsListProps {
  limit?: number;
}

export const ReputationEventsList = ({ limit = 10 }: ReputationEventsListProps) => {
  const { data: events, isLoading } = useReputationEvents(limit);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" />
            Recent Changes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!events || events.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" />
            Recent Changes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No reputation changes yet. Your actions will shape your reputation!
          </p>
        </CardContent>
      </Card>
    );
  }

  const getAxisName = (axis: ReputationAxis) => {
    return REPUTATION_AXES.find((a) => a.key === axis)?.name ?? axis;
  };

  const formatEventType = (eventType: string) => {
    return eventType
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5" />
          Recent Changes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-3">
            {events.map((event) => {
              const isPositive = event.change_amount > 0;
              const isNeutral = event.change_amount === 0;
              
              return (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-2 rounded-lg bg-muted/30"
                >
                  <div className={cn(
                    "p-1.5 rounded-full",
                    isPositive ? "bg-green-500/20 text-green-500" :
                    isNeutral ? "bg-muted text-muted-foreground" :
                    "bg-red-500/20 text-red-500"
                  )}>
                    {isPositive ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : isNeutral ? (
                      <Minus className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {getAxisName(event.axis)}
                      </Badge>
                      <span className={cn(
                        "text-xs font-semibold",
                        isPositive ? "text-green-500" : isNeutral ? "text-muted-foreground" : "text-red-500"
                      )}>
                        {isPositive ? `+${event.change_amount}` : event.change_amount}
                      </span>
                    </div>
                    <p className="text-sm mt-1">
                      {event.reason || formatEventType(event.event_type)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
