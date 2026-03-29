import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, Sector } from "recharts";
import { useState, useCallback } from "react";
import { TrendingUp } from "lucide-react";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(142, 76%, 36%)",
  "hsl(221, 83%, 53%)",
  "hsl(262, 83%, 58%)",
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const SOURCE_LABELS: Record<string, string> = {
  gig_performance: "Gig Performance",
  recording: "Recording",
  release: "Release Revenue",
  deposit: "Direct Deposit",
  merchandise: "Merchandise",
  streaming: "Streaming",
  sync_licensing: "Sync Licensing",
  crowdfunding: "Crowdfunding",
  sponsorship: "Sponsorship",
};

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  return (
    <g>
      <text x={cx} y={cy - 8} textAnchor="middle" fill="hsl(var(--foreground))" className="text-xs font-semibold">
        {payload.name}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="hsl(var(--muted-foreground))" className="text-[10px]">
        {currencyFormatter.format(value)}
      </text>
      <text x={cx} y={cy + 24} textAnchor="middle" fill="hsl(var(--muted-foreground))" className="text-[10px]">
        {(percent * 100).toFixed(1)}%
      </text>
      <Sector
        cx={cx} cy={cy}
        innerRadius={innerRadius} outerRadius={outerRadius + 6}
        startAngle={startAngle} endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx} cy={cy}
        innerRadius={outerRadius + 8} outerRadius={outerRadius + 11}
        startAngle={startAngle} endAngle={endAngle}
        fill={fill}
        opacity={0.4}
      />
    </g>
  );
};

interface IncomeBreakdownChartProps {
  earningsBySource: Record<string, number>;
}

export const IncomeBreakdownChart = ({ earningsBySource }: IncomeBreakdownChartProps) => {
  const [activeIndex, setActiveIndex] = useState(0);

  const data = Object.entries(earningsBySource)
    .map(([source, amount]) => ({
      name: SOURCE_LABELS[source] || source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      value: amount,
    }))
    .sort((a, b) => b.value - a.value);

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const topSource = data[0];

  const onPieEnter = useCallback((_: any, index: number) => {
    setActiveIndex(index);
  }, []);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Income Breakdown
          </CardTitle>
          <CardDescription>Revenue by source</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center">
          <p className="text-sm text-muted-foreground">No income data yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Income Breakdown
        </CardTitle>
        <CardDescription>
          {currencyFormatter.format(total)} total • {data.length} source{data.length !== 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                activeIndex={activeIndex}
                activeShape={renderActiveShape}
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
                onMouseEnter={onPieEnter}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [currencyFormatter.format(value), "Revenue"]}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Source breakdown list */}
        <div className="mt-2 space-y-1.5 max-h-[120px] overflow-y-auto">
          {data.map((item, i) => {
            const pct = ((item.value / total) * 100).toFixed(1);
            return (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-foreground truncate max-w-[120px]">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{pct}%</span>
                  <span className="font-medium text-foreground w-[70px] text-right">
                    {currencyFormatter.format(item.value)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
