import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Calendar, MapPin, Star, DollarSign, Users, Trophy, 
  TrendingUp, Newspaper, ChevronRight 
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { FestivalPerformanceRecord } from "@/hooks/useFestivalHistory";

interface FestivalHistoryCardProps {
  performance: FestivalPerformanceRecord;
  onViewDetails?: (performanceId: string) => void;
}

const SLOT_COLORS: Record<string, string> = {
  opening: "bg-slate-500",
  support: "bg-blue-500",
  main: "bg-purple-500",
  headline: "bg-amber-500",
};

export function FestivalHistoryCard({ performance, onViewDetails }: FestivalHistoryCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-yellow-500";
    if (score >= 80) return "text-green-500";
    if (score >= 70) return "text-blue-500";
    if (score >= 60) return "text-purple-500";
    return "text-orange-500";
  };

  const getScoreGrade = (score: number) => {
    if (score >= 90) return "S";
    if (score >= 80) return "A";
    if (score >= 70) return "B";
    if (score >= 60) return "C";
    if (score >= 50) return "D";
    return "F";
  };

  const totalEarnings = performance.payment_earned + performance.merch_revenue;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">
              {performance.festival?.title || "Festival Performance"}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              {performance.festival?.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {performance.festival.location}
                </span>
              )}
              {performance.performance_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(performance.performance_date), "MMM d, yyyy")}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {performance.slot_type && (
              <Badge className={cn(SLOT_COLORS[performance.slot_type] || "bg-gray-500", "text-white capitalize")}>
                {performance.slot_type}
              </Badge>
            )}
            <div className={cn("text-3xl font-bold", getScoreColor(performance.performance_score))}>
              {getScoreGrade(performance.performance_score)}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Score and Energy */}
        <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Score</p>
            <p className={cn("text-xl font-bold", getScoreColor(performance.performance_score))}>
              {performance.performance_score}/100
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Crowd Peak</p>
            <p className="text-xl font-bold text-orange-500">
              {performance.crowd_energy_peak}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Critic</p>
            <p className="text-xl font-bold text-blue-500">
              {performance.critic_score || "N/A"}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Fan</p>
            <p className="text-xl font-bold text-pink-500">
              {performance.fan_score || "N/A"}
            </p>
          </div>
        </div>

        {/* Review Headline */}
        {performance.review_headline && (
          <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg">
            <Newspaper className="h-4 w-4 mt-0.5 text-primary" />
            <div>
              <p className="font-medium text-sm">"{performance.review_headline}"</p>
              {performance.review_summary && (
                <p className="text-xs text-muted-foreground mt-1">{performance.review_summary}</p>
              )}
            </div>
          </div>
        )}

        {/* Rewards */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <DollarSign className="h-4 w-4 mx-auto text-green-500" />
            <p className="text-xs text-muted-foreground">Earned</p>
            <p className="font-semibold text-green-500">${totalEarnings.toLocaleString()}</p>
          </div>
          <div>
            <Star className="h-4 w-4 mx-auto text-yellow-500" />
            <p className="text-xs text-muted-foreground">Fame</p>
            <p className="font-semibold text-yellow-500">+{performance.fame_earned}</p>
          </div>
          <div>
            <Users className="h-4 w-4 mx-auto text-blue-500" />
            <p className="text-xs text-muted-foreground">New Fans</p>
            <p className="font-semibold text-blue-500">+{performance.new_fans_gained}</p>
          </div>
          <div>
            <Trophy className="h-4 w-4 mx-auto text-purple-500" />
            <p className="text-xs text-muted-foreground">Songs</p>
            <p className="font-semibold text-purple-500">{performance.songs_performed}</p>
          </div>
        </div>

        {/* View Details */}
        {onViewDetails && (
          <Button 
            variant="ghost" 
            className="w-full" 
            onClick={() => onViewDetails(performance.id)}
          >
            View Details
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
