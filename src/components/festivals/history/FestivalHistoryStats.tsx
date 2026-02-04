import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Trophy, Star, DollarSign, Users, Music, 
  TrendingUp, Award, Target 
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FestivalCareerStats } from "@/hooks/useFestivalHistory";

interface FestivalHistoryStatsProps {
  stats: FestivalCareerStats;
  className?: string;
}

export function FestivalHistoryStats({ stats, className }: FestivalHistoryStatsProps) {
  const statItems = [
    {
      label: "Total Performances",
      value: stats.totalPerformances,
      icon: Music,
      color: "text-primary",
    },
    {
      label: "Average Score",
      value: `${stats.averageScore}/100`,
      icon: Target,
      color: stats.averageScore >= 80 ? "text-green-500" : stats.averageScore >= 60 ? "text-yellow-500" : "text-orange-500",
    },
    {
      label: "Total Earnings",
      value: `$${stats.totalEarnings.toLocaleString()}`,
      icon: DollarSign,
      color: "text-green-500",
    },
    {
      label: "Fame Gained",
      value: `+${stats.totalFameGained.toLocaleString()}`,
      icon: Star,
      color: "text-yellow-500",
    },
    {
      label: "Merch Revenue",
      value: `$${stats.totalMerchRevenue.toLocaleString()}`,
      icon: Award,
      color: "text-purple-500",
    },
    {
      label: "New Fans",
      value: `+${stats.totalNewFans.toLocaleString()}`,
      icon: Users,
      color: "text-blue-500",
    },
    {
      label: "Headline Slots",
      value: stats.headlineSlots,
      icon: Trophy,
      color: "text-amber-500",
    },
    {
      label: "Unique Festivals",
      value: stats.uniqueFestivals,
      icon: TrendingUp,
      color: "text-pink-500",
    },
  ];

  return (
    <div className={cn("space-y-4", className)}>
      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statItems.map((stat) => (
          <Card key={stat.label} className="overflow-hidden">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <stat.icon className={cn("h-5 w-5", stat.color)} />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                  <p className={cn("font-bold", stat.color)}>{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Best Performance */}
      {stats.bestPerformance && (
        <Card className="border-2 border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Best Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">
                  {stats.bestPerformance.festival?.title || "Festival"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {stats.bestPerformance.festival?.location}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-yellow-500">
                  {stats.bestPerformance.performance_score}
                </p>
                <p className="text-xs text-muted-foreground">Score</p>
              </div>
            </div>
            {stats.bestPerformance.review_headline && (
              <Badge variant="secondary" className="mt-2">
                "{stats.bestPerformance.review_headline}"
              </Badge>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
