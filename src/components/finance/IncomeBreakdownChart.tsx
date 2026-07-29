import { useCallback, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from "recharts";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createCurrencyFormatter } from "@/lib/financeFormatting";

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

const SOURCE_LABELS: Record<string, string> = {
  gig_performance: "Gig Performance",
  recording: "Recording",
  release: "Release Revenue",
  merchandise: "Merchandise",
  streaming: "Streaming",
  sync_licensing: "Sync Licensing",
  crowdfunding: "Crowdfunding",
  sponsorship: "Sponsorship",
};

const renderActiveShape = (props: any, formatCurrency: (value: number) => string) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  return (
    <g>
      <text x={cx} y={cy - 8} textAnchor="middle" fill="hsl(var(--foreground))" className="text-xs font-semibold">{payload.name}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="hsl(var(--muted-foreground))" className="text-[10px]">{formatCurrency(value)}</text>
      <text x={cx} y={cy + 24} textAnchor="middle" fill="hsl(var(--muted-foreground))" className="text-[10px]">{(percent * 100).toFixed(1)}%</text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 6} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 8} outerRadius={outerRadius + 11} startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.4} />
    </g>
  );
};

interface IncomeBreakdownChartProps {
  earningsBySource: Record<string, number>;
  currencyCode: string;
}

export const IncomeBreakdownChart = ({ earningsBySource, currencyCode }: IncomeBreakdownChartProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const currencyFormatter = useMemo(() => createCurrencyFormatter(currencyCode), [currencyCode]);
  const data = Object.entries(earningsBySource)
    .map(([source, amount]) => ({
      name: SOURCE_LABELS[source] || source.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
      value: amount,
    }))
    .sort((left, right) => right.value - left.value);
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  const onPieEnter = useCallback((_: unknown, index: number) => setActiveIndex(index), []);

  if (!data.length) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Income Breakdown</CardTitle><CardDescription>External income by canonical ledger category</CardDescription></CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center"><p className="text-sm text-muted-foreground">No external income data yet.</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Income Breakdown</CardTitle>
        <CardDescription>{currencyFormatter.format(total)} total • {data.length} source{data.length === 1 ? "" : "s"}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie activeIndex={activeIndex} activeShape={(props: any) => renderActiveShape(props, (value) => currencyFormatter.format(value))} data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value" onMouseEnter={onPieEnter}>
                {data.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />)}
              </Pie>
              <Tooltip formatter={(value: number) => [currencyFormatter.format(value), "Revenue"]} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 max-h-[120px] space-y-1.5 overflow-y-auto">
          {data.map((item, index) => (
            <div key={item.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2"><div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} /><span className="max-w-[140px] truncate text-foreground">{item.name}</span></div>
              <div className="flex items-center gap-2"><span className="text-muted-foreground">{((item.value / total) * 100).toFixed(1)}%</span><span className="w-[82px] text-right font-medium text-foreground">{currencyFormatter.format(item.value)}</span></div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
