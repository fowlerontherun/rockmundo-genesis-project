import { useMemo } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ShoppingCart } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FinancialTransaction } from "@/hooks/useFinances";
import { createCurrencyFormatter } from "@/lib/financeFormatting";

const COLORS = [
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(262, 83%, 58%)",
  "hsl(221, 83%, 53%)",
];

const SOURCE_LABELS: Record<string, string> = {
  manufacturing: "Manufacturing",
  marketing: "Marketing",
  equipment: "Equipment",
  travel: "Travel",
  recording: "Recording",
  venue: "Venue Costs",
  merchandise: "Merch Production",
  promotion: "Promotion",
  band_contribution: "Band Contributions",
};

interface SpendingCategoriesChartProps {
  transactions: FinancialTransaction[];
  currencyCode: string;
}

export const SpendingCategoriesChart = ({ transactions, currencyCode }: SpendingCategoriesChartProps) => {
  const currencyFormatter = useMemo(() => createCurrencyFormatter(currencyCode), [currencyCode]);
  const byCategory: Record<string, number> = {};
  transactions
    .filter((transaction) => transaction.type === "expense" && transaction.externalCashFlow)
    .forEach((transaction) => {
      const label = SOURCE_LABELS[transaction.source] || transaction.source.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
      byCategory[label] = (byCategory[label] || 0) + transaction.amount;
    });

  const data = Object.entries(byCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 6);
  const total = data.reduce((sum, entry) => sum + entry.value, 0);

  if (!data.length) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-destructive" /> Spending Categories</CardTitle><CardDescription>External spending by ledger category</CardDescription></CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center"><p className="text-sm text-muted-foreground">No external expenses recorded yet.</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-destructive" /> Spending Categories</CardTitle>
        <CardDescription>{currencyFormatter.format(total)} spent across {data.length} categories</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 0, right: 8 }}>
              <XAxis type="number" tickFormatter={(value) => currencyFormatter.format(value)} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--foreground))" }} axisLine={false} tickLine={false} width={100} />
              <Tooltip formatter={(value: number) => [currencyFormatter.format(value), "Spent"]} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>{data.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
