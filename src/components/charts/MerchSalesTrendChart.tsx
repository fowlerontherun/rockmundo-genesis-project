import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { SalesTrendPoint } from "@/lib/api/merch";

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(var(--chart-1))",
  },
  orders: {
    label: "Orders",
    color: "hsl(var(--chart-2))",
  },
} as const;

interface MerchSalesTrendChartProps {
  data: SalesTrendPoint[];
}

export function MerchSalesTrendChart({ data }: MerchSalesTrendChartProps) {
  if (!data.length) {
    return (
      <div className="flex h-full items-center justify-center py-12 text-sm text-muted-foreground">
        No orders yet. Launch a merch drop to start generating analytics.
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-[320px]">
      <LineChart data={data} margin={{ left: 12, right: 12, top: 16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 4" vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={12}
          minTickGap={24}
        />
        <YAxis
          yAxisId="left"
          axisLine={false}
          tickLine={false}
          tickMargin={8}
          width={64}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          axisLine={false}
          tickLine={false}
          tickMargin={8}
          width={48}
        />
        <ChartTooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={
            <ChartTooltipContent
              formatter={(value, name) => {
                if (typeof value !== "number") {
                  return [value, chartConfig[name as keyof typeof chartConfig]?.label ?? name];
                }

                const label = chartConfig[name as keyof typeof chartConfig]?.label ?? name;
                if (name === "revenue") {
                  return [
                    new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: value >= 1000 ? 0 : 2,
                    }).format(value),
                    label,
                  ];
                }

                return [
                  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value),
                  label,
                ];
              }}
            />
          }
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="revenue"
          stroke="var(--color-revenue)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="orders"
          stroke="var(--color-orders)"
          strokeDasharray="6 4"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
