import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getAllGenreTrends, type GenreTrend } from "@/utils/genreTrends";
import { calculateInGameDate } from "@/utils/gameCalendar";

export const GenreTrendsWidget = () => {
  const trends = useMemo(() => {
    const gameDate = calculateInGameDate();
    const gameDay = gameDate.realWorldDaysElapsed;
    return getAllGenreTrends(gameDay);
  }, []);

  const getDirectionIcon = (direction: GenreTrend["direction"]) => {
    switch (direction) {
      case "rising": return <TrendingUp className="h-3 w-3 text-green-500" />;
      case "falling": return <TrendingDown className="h-3 w-3 text-red-500" />;
      default: return <Minus className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 1.3) return "bg-green-500/15 text-green-600 border-green-500/30";
    if (score >= 1.1) return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    if (score <= 0.7) return "bg-red-500/15 text-red-600 border-red-500/30";
    if (score <= 0.9) return "bg-orange-500/10 text-orange-600 border-orange-500/20";
    return "bg-muted text-muted-foreground border-border";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Genre Trends
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-1.5">
          {trends.slice(0, 10).map((trend) => (
            <div
              key={trend.genre}
              className="flex items-center justify-between px-2 py-1.5 rounded-md border text-xs"
            >
              <div className="flex items-center gap-1.5">
                {getDirectionIcon(trend.direction)}
                <span className="font-medium truncate">{trend.genre}</span>
              </div>
              <Badge variant="outline" className={`text-[10px] px-1 py-0 ${getScoreColor(trend.trendScore)}`}>
                {trend.label}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
