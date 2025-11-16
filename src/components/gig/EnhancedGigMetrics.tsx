import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Users, DollarSign, TrendingUp, Star, Zap, Heart, 
  Music, Award, Target, Sparkles 
} from "lucide-react";
import { motion } from "framer-motion";

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  progress?: number;
  trend?: "up" | "down" | "neutral";
  color?: string;
}

const MetricCard = ({ icon: Icon, label, value, subValue, progress, trend, color = "text-primary" }: MetricCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="p-4 rounded-lg border bg-card"
  >
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      {trend && (
        <TrendingUp 
          className={`h-4 w-4 ${
            trend === "up" ? "text-green-500" : 
            trend === "down" ? "text-red-500 rotate-180" : 
            "text-gray-500"
          }`} 
        />
      )}
    </div>
    <div className="text-2xl font-bold">{value}</div>
    {subValue && <div className="text-xs text-muted-foreground mt-1">{subValue}</div>}
    {progress !== undefined && (
      <Progress value={progress} className="mt-2 h-2" />
    )}
  </motion.div>
);

interface EnhancedGigMetricsProps {
  metrics: {
    attendance: number;
    capacity: number;
    revenue: number;
    fameGained: number;
    averagePerformanceScore: number;
    crowdEngagement: number;
    bestSong?: string;
    worstSong?: string;
    encoreWorthy: boolean;
    breakdowns: number;
    perfectSongs: number;
    totalSongs: number;
  };
}

export const EnhancedGigMetrics = ({ metrics }: EnhancedGigMetricsProps) => {
  const attendancePercent = (metrics.attendance / metrics.capacity) * 100;
  const performanceGrade = 
    metrics.averagePerformanceScore >= 90 ? "S" :
    metrics.averagePerformanceScore >= 80 ? "A" :
    metrics.averagePerformanceScore >= 70 ? "B" :
    metrics.averagePerformanceScore >= 60 ? "C" :
    metrics.averagePerformanceScore >= 50 ? "D" : "F";

  const gradeColors = {
    "S": "from-purple-500 to-pink-500",
    "A": "from-green-500 to-emerald-500",
    "B": "from-blue-500 to-cyan-500",
    "C": "from-yellow-500 to-orange-500",
    "D": "from-orange-500 to-red-500",
    "F": "from-red-500 to-red-700"
  };

  return (
    <div className="space-y-4">
      {/* Overall Grade */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                Overall Performance
              </h3>
              <div className="flex items-baseline gap-2">
                <div 
                  className={`text-6xl font-bold bg-gradient-to-r ${gradeColors[performanceGrade as keyof typeof gradeColors]} bg-clip-text text-transparent`}
                >
                  {performanceGrade}
                </div>
                <div className="text-2xl text-muted-foreground">
                  {metrics.averagePerformanceScore.toFixed(1)}%
                </div>
              </div>
            </div>
            
            {metrics.encoreWorthy && (
              <Badge variant="default" className="text-lg py-2 px-4">
                <Sparkles className="h-4 w-4 mr-2" />
                Encore Worthy!
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={Users}
          label="Attendance"
          value={metrics.attendance}
          subValue={`${attendancePercent.toFixed(0)}% capacity`}
          progress={attendancePercent}
          color="text-blue-500"
        />
        
        <MetricCard
          icon={DollarSign}
          label="Revenue"
          value={`$${metrics.revenue.toLocaleString()}`}
          trend={metrics.revenue > 1000 ? "up" : "neutral"}
          color="text-green-500"
        />
        
        <MetricCard
          icon={Star}
          label="Fame Gained"
          value={`+${metrics.fameGained}`}
          trend="up"
          color="text-yellow-500"
        />
        
        <MetricCard
          icon={Zap}
          label="Crowd Energy"
          value={`${metrics.crowdEngagement.toFixed(0)}%`}
          progress={metrics.crowdEngagement}
          color="text-orange-500"
        />
      </div>

      {/* Performance Highlights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Award className="h-5 w-5" />
            Performance Highlights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg border">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Perfect Songs</span>
              </div>
              <div className="text-2xl font-bold">
                {metrics.perfectSongs}/{metrics.totalSongs}
              </div>
              <Progress 
                value={(metrics.perfectSongs / metrics.totalSongs) * 100} 
                className="mt-2 h-2"
              />
            </div>

            {metrics.bestSong && (
              <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-950/20">
                <div className="flex items-center gap-2 mb-1">
                  <Music className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Best Performance</span>
                </div>
                <div className="text-sm font-semibold line-clamp-2">
                  {metrics.bestSong}
                </div>
              </div>
            )}

            {metrics.breakdowns > 0 && (
              <div className="p-3 rounded-lg border bg-red-50 dark:bg-red-950/20">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium">Equipment Issues</span>
                </div>
                <div className="text-2xl font-bold text-red-500">
                  {metrics.breakdowns}
                </div>
                <span className="text-xs text-muted-foreground">
                  Technical problems
                </span>
              </div>
            )}

            {!metrics.breakdowns && metrics.worstSong && (
              <div className="p-3 rounded-lg border bg-yellow-50 dark:bg-yellow-950/20">
                <div className="flex items-center gap-2 mb-1">
                  <Heart className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium">Room to Improve</span>
                </div>
                <div className="text-sm font-semibold line-clamp-2">
                  {metrics.worstSong}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
