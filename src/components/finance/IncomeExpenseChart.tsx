import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Line, ComposedChart, Bar } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useMemo } from "react";
import { BarChart3 } from "lucide-react";

interface IncomeExpenseChartProps {
  data: { month: string; income: number; expenses: number }[];
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const chartConfig = {
  income: {
    label: "Income",
    color: "hsl(142, 76%, 36%)",
  },
  expenses: {
    label: "Expenses",
    color: "hsl(var(--destructive))",
  },
  net: {
    label: "Net Profit",
    color: "hsl(var(--primary))",
  },
};

export const IncomeExpenseChart = ({ data }: IncomeExpenseChartProps) => {
  const enrichedData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      net: d.income - d.expenses,
    }));
  }, [data]);

  const hasData = data.length > 0;
  const totalIncome = data.reduce((s, d) => s + d.income, 0);
  const totalExpenses = data.reduce((s, d) => s + d.expenses, 0);
  const totalNet = totalIncome - totalExpenses;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Income vs. Expenses
        </CardTitle>
        <CardDescription>
          {hasData ? (
            <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
              <span className="text-emerald-500">↑ {currencyFormatter.format(totalIncome)}</span>
              <span className="text-destructive">↓ {currencyFormatter.format(totalExpenses)}</span>
              <span className={totalNet >= 0 ? "text-primary font-medium" : "text-destructive font-medium"}>
                Net: {totalNet >= 0 ? "+" : ""}{currencyFormatter.format(totalNet)}
              </span>
            </span>
          ) : (
            "Track the monthly cash flow of your creative business."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="h-72">
        {!hasData ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No transactions yet. Connect revenue streams to populate the chart.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-full w-full">
            <ComposedChart data={enrichedData} margin={{ left: 8, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="income-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-income)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-income)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="expense-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-expenses)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-expenses)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 11 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                width={60}
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => currencyFormatter.format(Number(value))}
              />
              <ChartTooltip
                cursor={{ strokeDasharray: "4 4" }}
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => [
                      currencyFormatter.format(typeof value === "number" ? value : Number(value)),
                      chartConfig[name as keyof typeof chartConfig]?.label ?? name,
                    ]}
                  />
                }
              />
              <Area type="monotone" dataKey="income" stroke="var(--color-income)" fill="url(#income-gradient)" strokeWidth={2} />
              <Area type="monotone" dataKey="expenses" stroke="var(--color-expenses)" fill="url(#expense-gradient)" strokeWidth={2} />
              <Line
                type="monotone"
                dataKey="net"
                stroke="var(--color-net)"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={{ r: 3, fill: "var(--color-net)" }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};
