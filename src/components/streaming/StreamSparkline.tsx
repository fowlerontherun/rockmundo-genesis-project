import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StreamSparklineProps {
  data: Array<{ date: string; streams: number }>;
  width?: number | string;
  height?: number;
}

/**
 * Compact 7-day stream sparkline with trend indicator.
 * Shows direction arrow + % change vs first day.
 */
export const StreamSparkline = ({ data, height = 36 }: StreamSparklineProps) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        <span>No 7d data</span>
      </div>
    );
  }

  const first = data[0]?.streams ?? 0;
  const last = data[data.length - 1]?.streams ?? 0;
  const total = data.reduce((s, d) => s + (d.streams || 0), 0);
  const pctChange = first > 0 ? Math.round(((last - first) / first) * 100) : last > 0 ? 100 : 0;

  const trendColor =
    pctChange > 5 ? "hsl(var(--primary))" : pctChange < -5 ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))";

  const TrendIcon = pctChange > 5 ? TrendingUp : pctChange < -5 ? TrendingDown : Minus;
  const trendTextClass =
    pctChange > 5 ? "text-primary" : pctChange < -5 ? "text-destructive" : "text-muted-foreground";

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 min-w-0" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <YAxis hide domain={[0, "dataMax + 1"]} />
            <Tooltip
              cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 6,
                fontSize: 11,
                padding: "4px 8px",
              }}
              labelStyle={{ color: "hsl(var(--muted-foreground))" }}
              formatter={(value: number) => [`${value.toLocaleString()} streams`, ""]}
              labelFormatter={(label) => label}
            />
            <Line
              type="monotone"
              dataKey="streams"
              stroke={trendColor}
              strokeWidth={1.75}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className={`flex items-center gap-0.5 text-xs font-medium shrink-0 ${trendTextClass}`}>
        <TrendIcon className="h-3 w-3" />
        <span>{pctChange > 0 ? "+" : ""}{pctChange}%</span>
      </div>
      <div className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
        {total.toLocaleString()}/7d
      </div>
    </div>
  );
};
