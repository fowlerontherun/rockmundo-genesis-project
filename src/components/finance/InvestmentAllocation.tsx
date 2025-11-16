import { Pie, PieChart, Cell } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { InvestmentPosition } from "@/lib/api/finance";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const allocationConfig = {
  equity: { label: "Equity", color: "hsl(var(--chart-1))" },
  realAssets: { label: "Real Assets", color: "hsl(var(--chart-2))" },
  cash: { label: "Cash", color: "hsl(var(--chart-3))" },
  royalties: { label: "Royalties", color: "hsl(var(--chart-4))" },
  startups: { label: "Startups", color: "hsl(var(--chart-5))" },
};

const categoryKey: Record<InvestmentPosition["category"], keyof typeof allocationConfig> = {
  Equity: "equity",
  "Real Assets": "realAssets",
  Cash: "cash",
  Royalties: "royalties",
  Startups: "startups",
};

interface InvestmentAllocationProps {
  positions: InvestmentPosition[];
}

export const InvestmentAllocation = ({ positions }: InvestmentAllocationProps) => {
  const allocation = Object.values(
    positions.reduce<Record<string, { label: string; value: number; key: keyof typeof allocationConfig }>>(
      (acc, position) => {
        const key = categoryKey[position.category];
        const existing = acc[key];
        const currentValue = position.currentValue;

        return {
          ...acc,
          [key]: {
            label: allocationConfig[key].label,
            key,
            value: (existing?.value ?? 0) + currentValue,
          },
        };
      },
      {},
    ),
  );

  const total = allocation.reduce((sum, item) => sum + item.value, 0);

  if (!allocation.length) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Allocation Mix</CardTitle>
          <CardDescription>Understand how your investments are distributed by asset class.</CardDescription>
        </CardHeader>
        <CardContent className="flex h-80 items-center justify-center text-sm text-muted-foreground">
          Add investments to visualize how your capital is allocated.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Allocation Mix</CardTitle>
        <CardDescription>Understand how your investments are distributed by asset class.</CardDescription>
      </CardHeader>
      <CardContent className="h-80">
        <ChartContainer config={allocationConfig} className="h-full w-full">
          <PieChart>
            <Pie data={allocation} dataKey="value" nameKey="label" innerRadius={70} outerRadius={110} paddingAngle={4}>
              {allocation.map((entry) => (
                <Cell key={entry.key} fill={`var(--color-${entry.key})`} stroke="transparent" />
              ))}
            </Pie>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => [
                    `${currencyFormatter.format(typeof value === "number" ? value : Number(value))} (${percentFormatter.format(
                      total ? (typeof value === "number" ? value : Number(value)) / total : 0,
                    )})`,
                    name,
                  ]}
                />
              }
            />
          </PieChart>
        </ChartContainer>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {allocation.map((item) => {
            const percentage = total ? item.value / total : 0;
            return (
              <div key={item.key} className="flex items-center justify-between rounded-lg border border-muted/40 bg-muted/5 p-3">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {currencyFormatter.format(item.value)} &bull; {percentFormatter.format(percentage)} of portfolio
                  </p>
                </div>
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: `var(--color-${item.key})` }}
                  aria-hidden
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

