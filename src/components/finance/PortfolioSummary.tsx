import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PortfolioSummaryProps {
  netWorth: number;
  invested: number;
  cashReserve: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  portfolioRoi: number;
}

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

export const PortfolioSummary = ({
  netWorth,
  invested,
  cashReserve,
  monthlyIncome,
  monthlyExpenses,
  portfolioRoi,
}: PortfolioSummaryProps) => {
  const monthlyNet = monthlyIncome - monthlyExpenses;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Snapshot</CardTitle>
        <CardDescription>Key indicators that define your current financial standing.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1 rounded-lg border border-muted/40 bg-muted/10 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Net Worth</p>
          <p className="text-2xl font-semibold">{currencyFormatter.format(netWorth)}</p>
          <p className="text-xs text-muted-foreground">Total current value across all accounts and holdings.</p>
        </div>
        <div className="space-y-1 rounded-lg border border-muted/40 bg-muted/10 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Invested Capital</p>
          <p className="text-2xl font-semibold">{currencyFormatter.format(invested)}</p>
          <p className="text-xs text-muted-foreground">Principal committed to long-term growth opportunities.</p>
        </div>
        <div className="space-y-1 rounded-lg border border-muted/40 bg-muted/10 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Cash Reserve</p>
          <p className="text-2xl font-semibold">{currencyFormatter.format(cashReserve)}</p>
          <p className="text-xs text-muted-foreground">Immediately deployable funds for touring, studio time, or emergencies.</p>
        </div>
        <div className="space-y-1 rounded-lg border border-muted/40 bg-muted/10 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Monthly Net Flow</p>
          <p className={`text-2xl font-semibold ${monthlyNet >= 0 ? "text-emerald-500" : "text-destructive"}`}>
            {currencyFormatter.format(monthlyNet)}
          </p>
          <p className="text-xs text-muted-foreground">
            {currencyFormatter.format(monthlyIncome)} in, {currencyFormatter.format(monthlyExpenses)} out. ROI {percentFormatter.format(portfolioRoi)}.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

