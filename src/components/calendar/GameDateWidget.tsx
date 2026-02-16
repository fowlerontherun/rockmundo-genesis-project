import { Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useGameCalendar } from "@/hooks/useGameCalendar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface GameDateWidgetProps {
  profileCreatedAt?: Date; // kept for backwards compat, no longer used
}

export function GameDateWidget({ profileCreatedAt }: GameDateWidgetProps) {
  const { data: calendar, isLoading } = useGameCalendar();

  if (isLoading) {
    return <Skeleton className="h-20 w-full" />;
  }

  if (!calendar) return null;

  const daysInSeason = 90; // 3 months × 30 days
  const dayInSeason = ((calendar.gameMonth - 1) % 3) * 30 + calendar.gameDay;
  const seasonProgress = (dayInSeason / daysInSeason) * 100;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="text-3xl">{calendar.seasonEmoji}</div>
                <span className="text-xs font-medium capitalize text-muted-foreground">{calendar.season}</span>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      Day {calendar.gameDay}, Year {calendar.gameYear}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {calendar.season} (Day {dayInSeason} of {daysInSeason})
                  </div>
                  <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${seasonProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">
            In-game calendar: 4 real months = 1 game year
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Seasons affect music sales, streams, and travel
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
