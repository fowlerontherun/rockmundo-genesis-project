import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { useSentimentEvents, type SentimentEvent } from "@/hooks/useSentimentEvents";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import { useMemo } from "react";
import { format } from "date-fns";

interface SentimentTrendChartProps {
  bandId: string | null;
  currentScore: number;
}

export const SentimentTrendChart = ({ bandId, currentScore }: SentimentTrendChartProps) => {
  const { data: events } = useSentimentEvents(bandId, 50);

  const chartData = useMemo(() => {
    if (!events?.length) return [];

    // Build timeline from oldest to newest using sentiment_after values
    const sorted = [...events].reverse();
    return sorted.map((e) => ({
      date: format(new Date(e.created_at), "MMM d"),
      time: format(new Date(e.created_at), "HH:mm"),
      score: e.sentiment_after ?? 0,
      change: e.sentiment_change,
      event: e.event_type.replace(/_/g, " "),
    }));
  }, [events]);

  if (!chartData.length) {
    return null;
  }

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-1 pt-3 px-3">
        <CardTitle className="text-xs font-oswald flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-primary" />
          Sentiment Trend
          <span className="text-[10px] font-mono text-muted-foreground ml-auto">
            Current: {currentScore}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-1 pb-2">
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={chartData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="sentimentGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[-100, 100]}
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              ticks={[-100, -50, 0, 50, 100]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                fontSize: "10px",
              }}
              formatter={(value: number, _name: string, props: any) => [
                `${value} (${props.payload.change > 0 ? "+" : ""}${props.payload.change})`,
                props.payload.event,
              ]}
              labelFormatter={(label) => label}
            />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.3} />
            <Area
              type="monotone"
              dataKey="score"
              stroke="hsl(var(--primary))"
              fill="url(#sentimentGrad)"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: "hsl(var(--primary))" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
