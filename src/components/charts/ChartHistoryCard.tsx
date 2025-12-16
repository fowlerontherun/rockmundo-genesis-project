import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Trophy, Crown, Star } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface ChartHistoryCardProps {
  songId: string;
  songTitle: string;
}

export const ChartHistoryCard = ({ songId, songTitle }: ChartHistoryCardProps) => {
  const { data: history, isLoading } = useQuery({
    queryKey: ["chart-history", songId],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data, error } = await supabase
        .from("chart_entries")
        .select("rank, chart_date, chart_type, plays_count, trend")
        .eq("song_id", songId)
        .gte("chart_date", thirtyDaysAgo.toISOString().split('T')[0])
        .order("chart_date", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!songId,
  });

  if (isLoading || !history?.length) {
    return null;
  }

  // Get peak position and current stats
  const peakPosition = Math.min(...history.map(h => h.rank));
  const currentPosition = history[history.length - 1]?.rank;
  const weeksOnChart = history.length;
  const totalPlays = history.reduce((sum, h) => sum + (h.plays_count || 0), 0);

  // Prepare chart data (invert rank so higher = better visually)
  const chartData = history.map(h => ({
    date: new Date(h.chart_date!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    position: 101 - h.rank, // Invert for visual
    actualRank: h.rank,
  }));

  const getPositionBadge = (position: number) => {
    if (position === 1) return <Badge className="bg-yellow-500 text-black"><Crown className="h-3 w-3 mr-1" /> #1</Badge>;
    if (position <= 10) return <Badge className="bg-primary"><Trophy className="h-3 w-3 mr-1" /> Top 10</Badge>;
    if (position <= 40) return <Badge variant="secondary"><Star className="h-3 w-3 mr-1" /> Top 40</Badge>;
    return <Badge variant="outline">#{position}</Badge>;
  };

  const getTrendFromHistory = () => {
    if (history.length < 2) return "stable";
    const recent = history[history.length - 1].rank;
    const previous = history[history.length - 2].rank;
    if (recent < previous) return "up";
    if (recent > previous) return "down";
    return "stable";
  };

  const trend = getTrendFromHistory();

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{songTitle}</CardTitle>
          {getPositionBadge(currentPosition)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-2xl font-bold text-primary">#{currentPosition}</p>
            <p className="text-xs text-muted-foreground">Current</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-yellow-500">#{peakPosition}</p>
            <p className="text-xs text-muted-foreground">Peak</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{weeksOnChart}</p>
            <p className="text-xs text-muted-foreground">Weeks</p>
          </div>
          <div className="flex flex-col items-center">
            {trend === "up" && <TrendingUp className="h-6 w-6 text-green-500" />}
            {trend === "down" && <TrendingDown className="h-6 w-6 text-red-500" />}
            {trend === "stable" && <Minus className="h-6 w-6 text-muted-foreground" />}
            <p className="text-xs text-muted-foreground">Trend</p>
          </div>
        </div>

        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} hide />
              <Tooltip 
                formatter={(value: any, name: string, props: any) => [`#${props.payload.actualRank}`, "Position"]}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Line 
                type="monotone" 
                dataKey="position" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          {totalPlays.toLocaleString()} total plays over {weeksOnChart} weeks
        </p>
      </CardContent>
    </Card>
  );
};
