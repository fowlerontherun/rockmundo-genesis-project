import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Users, ThumbsUp, ThumbsDown, Meh, Flame, Heart, Zap } from "lucide-react";

interface SongPerformance {
  song_id: string;
  song_title?: string;
  position: number;
  performance_score: number;
  crowd_response: string;
}

interface CrowdAnalyticsCardProps {
  actualAttendance: number;
  venueCapacity: number;
  songPerformances: SongPerformance[];
  overallRating: number;
}

export const CrowdAnalyticsCard = ({
  actualAttendance,
  venueCapacity,
  songPerformances,
  overallRating,
}: CrowdAnalyticsCardProps) => {
  const attendancePercentage = (actualAttendance / venueCapacity) * 100;

  // Calculate crowd response distribution
  const responseDistribution = songPerformances.reduce((acc, sp) => {
    acc[sp.crowd_response] = (acc[sp.crowd_response] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalResponses = songPerformances.length;
  
  const getResponsePercentage = (response: string) => {
    return totalResponses > 0 ? ((responseDistribution[response] || 0) / totalResponses) * 100 : 0;
  };

  // Calculate engagement metrics
  const ecstaticCount = responseDistribution['ecstatic'] || 0;
  const enthusiasticCount = responseDistribution['enthusiastic'] || 0;
  const engagedCount = responseDistribution['engaged'] || 0;
  const mixedCount = responseDistribution['mixed'] || 0;
  const disappointedCount = responseDistribution['disappointed'] || 0;

  const positiveResponses = ecstaticCount + enthusiasticCount;
  const neutralResponses = engagedCount + mixedCount;
  const negativeResponses = disappointedCount;

  const crowdSatisfaction = totalResponses > 0 
    ? ((positiveResponses * 100 + neutralResponses * 60 + negativeResponses * 20) / totalResponses)
    : 0;

  // Energy level calculation
  const avgScore = songPerformances.reduce((sum, sp) => sum + sp.performance_score, 0) / Math.max(1, totalResponses);
  const energyLevel = Math.min(100, (avgScore / 25) * 100 + (positiveResponses / Math.max(1, totalResponses)) * 20);

  // Encore probability
  const encoreProbability = Math.min(100, Math.max(0, 
    (overallRating / 25) * 60 + 
    (attendancePercentage / 100) * 20 + 
    (positiveResponses / Math.max(1, totalResponses)) * 20
  ));

  const getAttendanceLabel = () => {
    if (attendancePercentage >= 95) return { label: 'SOLD OUT', color: 'text-green-500', bg: 'bg-green-500/20' };
    if (attendancePercentage >= 80) return { label: 'Packed', color: 'text-green-400', bg: 'bg-green-500/10' };
    if (attendancePercentage >= 60) return { label: 'Good Crowd', color: 'text-yellow-500', bg: 'bg-yellow-500/10' };
    if (attendancePercentage >= 40) return { label: 'Moderate', color: 'text-orange-500', bg: 'bg-orange-500/10' };
    return { label: 'Sparse', color: 'text-red-500', bg: 'bg-red-500/10' };
  };

  const attendanceInfo = getAttendanceLabel();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Crowd Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Attendance Overview */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Attendance</span>
            <Badge className={attendanceInfo.bg + ' ' + attendanceInfo.color}>
              {attendanceInfo.label}
            </Badge>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{actualAttendance.toLocaleString()}</span>
            <span className="text-muted-foreground">/ {venueCapacity.toLocaleString()}</span>
          </div>
          <Progress value={attendancePercentage} className="h-3" />
          <p className="text-xs text-muted-foreground text-center">
            {attendancePercentage.toFixed(1)}% capacity filled
          </p>
        </div>

        {/* Crowd Response Distribution */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Crowd Response by Song</h4>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-red-500" />
              <span className="text-xs w-20">Ecstatic</span>
              <Progress value={getResponsePercentage('ecstatic')} className="flex-1 h-2" />
              <span className="text-xs w-8 text-right">{ecstaticCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-pink-500" />
              <span className="text-xs w-20">Enthusiastic</span>
              <Progress value={getResponsePercentage('enthusiastic')} className="flex-1 h-2" />
              <span className="text-xs w-8 text-right">{enthusiasticCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <ThumbsUp className="w-4 h-4 text-green-500" />
              <span className="text-xs w-20">Engaged</span>
              <Progress value={getResponsePercentage('engaged')} className="flex-1 h-2" />
              <span className="text-xs w-8 text-right">{engagedCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <Meh className="w-4 h-4 text-yellow-500" />
              <span className="text-xs w-20">Mixed</span>
              <Progress value={getResponsePercentage('mixed')} className="flex-1 h-2" />
              <span className="text-xs w-8 text-right">{mixedCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <ThumbsDown className="w-4 h-4 text-gray-500" />
              <span className="text-xs w-20">Disappointed</span>
              <Progress value={getResponsePercentage('disappointed')} className="flex-1 h-2" />
              <span className="text-xs w-8 text-right">{disappointedCount}</span>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border/50">
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-1">
              <Heart className="w-4 h-4 text-pink-500" />
            </div>
            <p className="text-xl font-bold">{crowdSatisfaction.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Satisfaction</p>
          </div>
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-1">
              <Zap className="w-4 h-4 text-yellow-500" />
            </div>
            <p className="text-xl font-bold">{energyLevel.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Energy Level</p>
          </div>
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-1">
              <Flame className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-xl font-bold">{encoreProbability.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Encore Worthy</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
