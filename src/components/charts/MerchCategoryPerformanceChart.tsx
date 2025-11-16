import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import type { CategoryPerformancePoint } from "@/lib/api/merch";

const chartConfig = {
  stock: {
    label: "In Stock",
    color: "hsl(var(--chart-3))",
  },
  sold: {
    label: "Sold",
    color: "hsl(var(--chart-4))",
  },
} as const;

interface MerchCategoryPerformanceChartProps {
  data: CategoryPerformancePoint[];
}

export function MerchCategoryPerformanceChart({ data }: MerchCategoryPerformanceChartProps) {
  if (!data.length) {
    return (
      <div className="flex h-full items-center justify-center py-12 text-sm text-muted-foreground">
        Inventory data will populate once you add merch items to Supabase.
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-[320px]">
      <BarChart data={data} margin={{ left: 12, right: 12, top: 16, bottom: 24 }}>
        <CartesianGrid strokeDasharray="4 4" vertical={false} />
        <XAxis
          dataKey="category"
          tickLine={false}
          axisLine={false}
          tickMargin={12}
        />
        <YAxis
          allowDecimals={false}
          axisLine={false}
          tickLine={false}
          tickMargin={8}
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted))" }}
          content={<ChartTooltipContent formatter={(value) => value} />}
        />
        <Legend
          verticalAlign="top"
          align="right"
          iconType="circle"
          wrapperStyle={{ paddingBottom: 12 }}
        />
        <Bar
          dataKey="stock"
          fill="var(--color-stock)"
          radius={[6, 6, 0, 0]}
          maxBarSize={48}
        />
        <Bar
          dataKey="sold"
          fill="var(--color-sold)"
          radius={[6, 6, 0, 0]}
          maxBarSize={48}
        />
      </BarChart>
    </ChartContainer>
  );
}
