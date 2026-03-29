import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { ShoppingCart } from "lucide-react";
import type { FinancialTransaction } from "@/hooks/useFinances";

const COLORS = [
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(262, 83%, 58%)",
  "hsl(221, 83%, 53%)",
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const SOURCE_LABELS: Record<string, string> = {
  manufacturing: "Manufacturing",
  marketing: "Marketing",
  equipment: "Equipment",
  travel: "Travel",
  recording: "Recording",
  venue: "Venue Costs",
  merchandise: "Merch Production",
  promotion: "Promotion",
};

interface SpendingCategoriesChartProps {
  transactions: FinancialTransaction[];
}

export const SpendingCategoriesChart = ({ transactions }: SpendingCategoriesChartProps) => {
  const expenses = transactions.filter((t) => t.type === "expense");

  const byCategory: Record<string, number> = {};
  expenses.forEach((t) => {
    const label = SOURCE_LABELS[t.source] || t.source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    byCategory[label] = (byCategory[label] || 0) + t.amount;
  });

  const data = Object.entries(byCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const total = data.reduce((s, d) => s + d.value, 0);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-destructive" />
            Spending Categories
          </CardTitle>
          <CardDescription>Where your money goes</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center">
          <p className="text-sm text-muted-foreground">No expenses recorded yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-destructive" />
          Spending Categories
        </CardTitle>
        <CardDescription>
          {currencyFormatter.format(total)} spent across {data.length} categories
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 0, right: 8 }}>
              <XAxis
                type="number"
                tickFormatter={(v) => currencyFormatter.format(v)}
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 10, fill: "hsl(var(--foreground))" }}
                axisLine={false}
                tickLine={false}
                width={90}
              />
              <Tooltip
                formatter={(value: number) => [currencyFormatter.format(value), "Spent"]}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
                {data.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
