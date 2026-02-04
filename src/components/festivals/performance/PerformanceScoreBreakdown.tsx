import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Trophy, Star, DollarSign, Users, TrendingUp, 
  Music, Heart, Newspaper, Shirt, Sparkles 
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PerformanceResult } from "@/hooks/useFestivalPerformance";

interface PerformanceScoreBreakdownProps {
  result: PerformanceResult;
  onClose?: () => void;
}

export function PerformanceScoreBreakdown({ result, onClose }: PerformanceScoreBreakdownProps) {
  const getScoreGrade = (score: number) => {
    if (score >= 90) return { grade: "S", color: "text-yellow-500", bg: "bg-yellow-500/20" };
    if (score >= 80) return { grade: "A", color: "text-green-500", bg: "bg-green-500/20" };
    if (score >= 70) return { grade: "B", color: "text-blue-500", bg: "bg-blue-500/20" };
    if (score >= 60) return { grade: "C", color: "text-purple-500", bg: "bg-purple-500/20" };
    if (score >= 50) return { grade: "D", color: "text-orange-500", bg: "bg-orange-500/20" };
    return { grade: "F", color: "text-red-500", bg: "bg-red-500/20" };
  };

  const scoreGrade = getScoreGrade(result.performanceScore);

  const rewardItems = [
    { label: "Payment", value: `$${result.paymentEarned.toLocaleString()}`, icon: DollarSign, color: "text-green-500" },
    { label: "Fame", value: `+${result.fameEarned.toLocaleString()}`, icon: Star, color: "text-yellow-500" },
    { label: "Merch Sales", value: `$${result.merchRevenue.toLocaleString()}`, icon: Shirt, color: "text-purple-500" },
    { label: "New Fans", value: `+${result.newFansGained.toLocaleString()}`, icon: Users, color: "text-blue-500" },
  ];

  const metrics = [
    { label: "Crowd Peak", value: result.crowdEnergyPeak, max: 100 },
    { label: "Crowd Average", value: result.crowdEnergyAvg, max: 100 },
    { label: "Critic Score", value: result.criticScore, max: 100 },
    { label: "Fan Score", value: result.fanScore, max: 100 },
  ];

  return (
    <div className="space-y-4">
      {/* Main Score Card */}
      <Card className="border-2 border-primary/50 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader className="text-center pb-2">
          <CardTitle className="flex items-center justify-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Performance Complete!
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className={cn("text-6xl font-bold", scoreGrade.color)}>
              {result.performanceScore}
            </div>
            <div className={cn("text-4xl font-bold p-3 rounded-lg", scoreGrade.bg, scoreGrade.color)}>
              {scoreGrade.grade}
            </div>
          </div>
          <Progress value={result.performanceScore} className="h-3 mb-2" />
          <p className="text-muted-foreground">
            Performance Score
          </p>
        </CardContent>
      </Card>

      {/* Review Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Newspaper className="h-4 w-4" />
            Review
          </CardTitle>
        </CardHeader>
        <CardContent>
          <h3 className="font-bold text-lg mb-1">"{result.reviewHeadline}"</h3>
          <p className="text-sm text-muted-foreground">{result.reviewSummary}</p>
          <div className="flex gap-4 mt-3">
            <Badge variant="outline" className="flex items-center gap-1">
              <Star className="h-3 w-3" />
              Critics: {result.criticScore}/100
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Heart className="h-3 w-3" />
              Fans: {result.fanScore}/100
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Rewards Grid */}
      <div className="grid grid-cols-2 gap-3">
        {rewardItems.map((item) => (
          <Card key={item.label} className="overflow-hidden">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <item.icon className={cn("h-5 w-5", item.color)} />
                <div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className={cn("font-bold", item.color)}>{item.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed Metrics */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Performance Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <div className="flex justify-between text-sm mb-1">
                <span>{metric.label}</span>
                <span className="font-medium">{metric.value}/{metric.max}</span>
              </div>
              <Progress value={metric.value} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Highlights */}
      {result.highlights.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-500" />
              Highlights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {result.highlights.map((highlight, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm">
                  <Music className="h-3 w-3 text-primary" />
                  {highlight}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
