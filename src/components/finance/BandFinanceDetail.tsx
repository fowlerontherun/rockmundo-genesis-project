import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, TrendingDown } from "lucide-react";
import type { BandFinance, FinancialTransaction } from "@/hooks/useFinances";

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

interface BandFinanceDetailProps {
  bands: BandFinance[];
  transactions: FinancialTransaction[];
}

export const BandFinanceDetail = ({ bands, transactions }: BandFinanceDetailProps) => {
  const totalBandEquity = bands.reduce((sum, b) => sum + b.playerShare, 0);

  if (bands.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Band Finances</CardTitle>
          <CardDescription>Your share of band funds</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[150px] items-center justify-center">
          <div className="text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              Join or create a band to track shared finances
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Per-band income/expense breakdown from transactions
  const bandBreakdowns = bands.map((band) => {
    const bandTxns = transactions.filter((t) => t.bandName === band.name);
    const income = bandTxns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expenses = bandTxns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const incomeSources: Record<string, number> = {};
    bandTxns
      .filter((t) => t.type === "income")
      .forEach((t) => {
        incomeSources[t.source] = (incomeSources[t.source] || 0) + t.amount;
      });

    return { ...band, income, expenses, profit: income - expenses, incomeSources };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Band Finances</CardTitle>
        <CardDescription>
          Your equity: {fmt.format(totalBandEquity)} across {bands.length} band{bands.length !== 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Band</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Income</TableHead>
              <TableHead className="text-right">Expenses</TableHead>
              <TableHead className="text-right">P&L</TableHead>
              <TableHead className="text-right">Your Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bandBreakdowns.map((band) => (
              <TableRow key={band.id}>
                <TableCell className="font-medium">{band.name}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {fmt.format(band.balance)}
                </TableCell>
                <TableCell className="text-right text-emerald-500">{fmt.format(band.income)}</TableCell>
                <TableCell className="text-right text-destructive">{fmt.format(band.expenses)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {band.profit >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-destructive" />
                    )}
                    <span className={band.profit >= 0 ? "text-emerald-500" : "text-destructive"}>
                      {fmt.format(band.profit)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold text-emerald-500">
                  {fmt.format(band.playerShare)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Income source badges */}
        {bandBreakdowns.map(
          (band) =>
            Object.keys(band.incomeSources).length > 0 && (
              <div key={band.id + "-sources"} className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {band.name} — Income by Source
                </p>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(band.incomeSources)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 6)
                    .map(([source, amount]) => (
                      <Badge key={source} variant="secondary" className="text-xs">
                        {source}: {fmt.format(amount)}
                      </Badge>
                    ))}
                </div>
              </div>
            )
        )}
      </CardContent>
    </Card>
  );
};
