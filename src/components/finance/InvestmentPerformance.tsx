import { ArrowDownRight, ArrowUpRight, Info } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { PortfolioPerformanceSummary } from "@/lib/api/finance";

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

interface InvestmentPerformanceProps {
  summary: PortfolioPerformanceSummary;
}

export const InvestmentPerformance = ({ summary }: InvestmentPerformanceProps) => {
  const { positions, totalInvested, totalCurrentValue, netGain, roi, annualizedRoi } = summary;

  if (!positions.length) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Investment Performance</CardTitle>
          <CardDescription>Track the results of your long-term capital plays.</CardDescription>
        </CardHeader>
        <CardContent className="flex h-80 items-center justify-center text-sm text-muted-foreground">
          Connect investment accounts to see performance metrics.
        </CardContent>
      </Card>
    );
  }

  const sortedPositions = [...positions].sort((a, b) => b.roi - a.roi);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Investment Performance</CardTitle>
        <CardDescription>Track the results of your long-term capital plays.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 rounded-lg border border-muted/40 bg-muted/10 p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Portfolio ROI</p>
              <p className="text-xl font-semibold">{percentFormatter.format(roi)}</p>
            </div>
            <Badge variant={roi >= 0 ? "default" : "destructive"} className="gap-1">
              {roi >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {percentFormatter.format(annualizedRoi)} annualized
            </Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Current Value</p>
              <p className="text-base font-semibold">{currencyFormatter.format(totalCurrentValue)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Net Gain</p>
              <p className={`text-base font-semibold ${netGain >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                {currencyFormatter.format(netGain)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            Based on {currencyFormatter.format(totalInvested)} invested capital across {positions.length} holdings.
          </div>
        </div>

        <div className="space-y-4">
          {sortedPositions.map((item) => {
            const gain = item.position.currentValue - item.position.investedAmount;
            const roiValue = percentFormatter.format(item.roi);
            const annualizedValue = percentFormatter.format(item.annualizedRoi);
            const progressValue = Math.min(Math.max((item.roi + 0.5) * 100, 5), 100);

            return (
              <div
                key={item.position.id}
                className="rounded-lg border border-muted/40 bg-background/70 p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{item.position.name}</p>
                    <p className="text-xs text-muted-foreground">{item.position.category}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>Invested: {currencyFormatter.format(item.position.investedAmount)}</div>
                    <div>Value: {currencyFormatter.format(item.position.currentValue)}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  <Badge variant={item.roi >= 0 ? "secondary" : "destructive"} className="gap-1">
                    {item.roi >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                    {roiValue}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Annualized {annualizedValue}</span>
                  <span className="text-xs text-muted-foreground">Gain {currencyFormatter.format(gain)}</span>
                </div>
                <Progress value={progressValue} className="mt-3 h-2" />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

