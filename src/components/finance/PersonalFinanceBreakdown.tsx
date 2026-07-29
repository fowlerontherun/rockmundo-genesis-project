import { Car, Guitar, Home, Landmark, TrendingDown, Wallet, WalletCards } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { FinancialSummary } from "@/hooks/useFinances";
import { formatMoney } from "@/lib/financeFormatting";

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
  const money = (amount: number) => formatMoney(amount, summary.currencyCode);
  const totalAssets = summary.personalAccounts + summary.investmentValue + propertyValue + vehicleValue + gearValue;
  const totalLiabilities = summary.totalLoans;
  const netWorth = totalAssets - totalLiabilities;

  const assetRows = [
    { label: "Wallet cash", value: summary.cash, icon: Wallet, color: "text-emerald-500" },
    {
      label: "Bank and savings balances",
      value: Math.max(0, summary.personalAccounts - summary.cash),
      icon: WalletCards,
      color: "text-cyan-500",
    },
    { label: "Investments", value: summary.investmentValue, icon: Landmark, color: "text-blue-500" },
    { label: "Property", value: propertyValue, icon: Home, color: "text-amber-500" },
    { label: "Vehicles", value: vehicleValue, icon: Car, color: "text-purple-500" },
    { label: "Gear and equipment", value: gearValue, icon: Guitar, color: "text-orange-500" },
  ];

  const assetsNonZero = assetRows.filter((row) => row.value > 0);
  const solvencyPercent = totalAssets > 0 ? Math.max(0, Math.min(100, (netWorth / totalAssets) * 100)) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Personal Finance Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Personal net worth</span>
            <span className={`font-bold ${netWorth >= 0 ? "text-emerald-500" : "text-destructive"}`}>{money(netWorth)}</span>
          </div>
          <Progress value={solvencyPercent} className="h-2" />
          <p className="text-xs text-muted-foreground">Band treasuries and foreign currencies are excluded.</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Assets</p>
          {assetsNonZero.length === 0 ? (
            <p className="text-sm text-muted-foreground">No personal assets recorded yet.</p>
          ) : (
            assetsNonZero.map((row) => (
              <div key={row.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2"><row.icon className={`h-4 w-4 ${row.color}`} /><span className="text-sm">{row.label}</span></div>
                <span className="text-sm font-medium">{money(row.value)}</span>
              </div>
            ))
          )}
          <div className="flex items-center justify-between border-t border-border pt-1">
            <span className="text-sm font-semibold">Total personal assets</span>
            <span className="text-sm font-bold text-emerald-500">{money(totalAssets)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Liabilities</p>
          {totalLiabilities > 0 ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><TrendingDown className="h-4 w-4 text-destructive" /><span className="text-sm">Canonical loan contracts</span></div>
              <span className="text-sm font-medium text-destructive">{money(totalLiabilities)}</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No outstanding canonical liabilities.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
