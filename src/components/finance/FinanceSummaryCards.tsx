import { Card, CardContent } from "@/components/ui/card";
import { Wallet, TrendingUp, Landmark, ArrowUpDown } from "lucide-react";
import type { FinancialSummary } from "@/hooks/useFinances";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

interface FinanceSummaryCardsProps {
  summary: FinancialSummary;
}

export const FinanceSummaryCards = ({ summary }: FinanceSummaryCardsProps) => {
  const monthlyNet = summary.monthlyIncome - summary.monthlyExpenses;

  const cards = [
    {
      label: "Cash on Hand",
      value: currencyFormatter.format(summary.cash),
      icon: Wallet,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Net Worth",
      value: currencyFormatter.format(summary.netWorth),
      icon: TrendingUp,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Investments",
      value: currencyFormatter.format(summary.investmentValue),
      subtext: summary.totalInvested > 0 
        ? `${((summary.investmentValue - summary.totalInvested) / summary.totalInvested * 100).toFixed(1)}% gain`
        : undefined,
      icon: Landmark,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Monthly Cash Flow",
      value: currencyFormatter.format(monthlyNet),
      subtext: `${currencyFormatter.format(summary.monthlyIncome)} in / ${currencyFormatter.format(summary.monthlyExpenses)} out`,
      icon: ArrowUpDown,
      color: monthlyNet >= 0 ? "text-emerald-500" : "text-destructive",
      bg: monthlyNet >= 0 ? "bg-emerald-500/10" : "bg-destructive/10",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                {card.subtext && (
                  <p className="text-xs text-muted-foreground">{card.subtext}</p>
                )}
              </div>
              <div className={`rounded-lg p-2 ${card.bg}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
