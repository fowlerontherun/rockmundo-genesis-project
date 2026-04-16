import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Wallet, Home, Car, Guitar, Landmark, TrendingDown } from "lucide-react";
import type { FinancialSummary } from "@/hooks/useFinances";

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

interface PersonalFinanceBreakdownProps {
  summary: FinancialSummary;
  propertyValue?: number;
  vehicleValue?: number;
  gearValue?: number;
}

export const PersonalFinanceBreakdown = ({
  summary,
  propertyValue = 0,
  vehicleValue = 0,
  gearValue = 0,
}: PersonalFinanceBreakdownProps) => {
  const totalAssets = summary.cash + summary.investmentValue + propertyValue + vehicleValue + gearValue;
  const totalLiabilities = summary.totalLoans;
  const netWorth = totalAssets - totalLiabilities;

  const assetRows = [
    { label: "Cash", value: summary.cash, icon: Wallet, color: "text-emerald-500" },
    { label: "Investments", value: summary.investmentValue, icon: Landmark, color: "text-blue-500" },
    { label: "Property", value: propertyValue, icon: Home, color: "text-amber-500" },
    { label: "Vehicles", value: vehicleValue, icon: Car, color: "text-purple-500" },
    { label: "Gear & Equipment", value: gearValue, icon: Guitar, color: "text-orange-500" },
  ];

  const assetsNonZero = assetRows.filter((r) => r.value > 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Personal Finance Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Net Worth Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Net Worth</span>
            <span className={`font-bold ${netWorth >= 0 ? "text-emerald-500" : "text-destructive"}`}>
              {fmt.format(netWorth)}
            </span>
          </div>
          <Progress
            value={totalAssets > 0 ? Math.min(((totalAssets - totalLiabilities) / totalAssets) * 100, 100) : 0}
            className="h-2"
          />
        </div>

        {/* Assets */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assets</p>
          {assetsNonZero.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assets recorded yet</p>
          ) : (
            assetsNonZero.map((row) => (
              <div key={row.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <row.icon className={`h-4 w-4 ${row.color}`} />
                  <span className="text-sm">{row.label}</span>
                </div>
                <span className="text-sm font-medium">{fmt.format(row.value)}</span>
              </div>
            ))
          )}
          <div className="flex items-center justify-between border-t border-border pt-1">
            <span className="text-sm font-semibold">Total Assets</span>
            <span className="text-sm font-bold text-emerald-500">{fmt.format(totalAssets)}</span>
          </div>
        </div>

        {/* Liabilities */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Liabilities</p>
          {totalLiabilities > 0 ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                <span className="text-sm">Active Loans</span>
              </div>
              <span className="text-sm font-medium text-destructive">{fmt.format(totalLiabilities)}</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No outstanding liabilities</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
