import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, TrendingDown, ShieldCheck } from "lucide-react";
import { FMFilterBar, type FilterPill } from "@/components/fm/FMFilterBar";
import type { BandFinance, FinancialTransaction } from "@/hooks/useFinances";

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

type PnlFilter = "all" | "profit" | "loss";

interface BandFinanceDetailProps {
  bands: BandFinance[];
  transactions: FinancialTransaction[];
}

export const BandFinanceDetail = ({ bands, transactions }: BandFinanceDetailProps) => {
  const [search, setSearch] = useState("");
  const [pnlFilter, setPnlFilter] = useState<PnlFilter>("all");

  const totalBandEquity = bands.reduce((sum, b) => sum + b.playerShare, 0);

  // Per-band income/expense breakdown from transactions
  const bandBreakdowns = useMemo(
    () =>
      bands.map((band) => {
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
      }),
    [bands, transactions],
  );

  const counts = useMemo(() => {
    let profit = 0;
    let loss = 0;
    for (const b of bandBreakdowns) {
      if (b.profit >= 0) profit++;
      else loss++;
    }
    return { all: bandBreakdowns.length, profit, loss };
  }, [bandBreakdowns]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bandBreakdowns.filter((b) => {
      if (pnlFilter === "profit" && b.profit < 0) return false;
      if (pnlFilter === "loss" && b.profit >= 0) return false;
      if (!q) return true;
      return b.name.toLowerCase().includes(q);
    });
  }, [bandBreakdowns, search, pnlFilter]);

  const pills: FilterPill<PnlFilter>[] = [
    { value: "all", label: "All", count: counts.all },
    { value: "profit", label: "Profitable", count: counts.profit },
    { value: "loss", label: "Loss", count: counts.loss },
  ];

  if (bands.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Band Finances</CardTitle>
          <CardDescription>Your share of band funds</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[150px] items-center justify-center">
          <div className="text-center">
            <Users className="mx-auto h-8 w-8 text-fm-fg-muted/50" />
            <p className="mt-2 text-xs text-fm-fg-muted">
              Join or create a band to track shared finances
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Band Finances</CardTitle>
        <CardDescription>
          Treasury access: {fmt.format(totalBandEquity)} member share across {bands.length} band{bands.length !== 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <FMFilterBar
          label="Bands"
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search band name…"
          pills={pills}
          activePill={pnlFilter}
          onPillChange={(v) => setPnlFilter(v as PnlFilter)}
        />
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
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-fm-fg-muted py-6">
                  No bands match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((band) => (
              <TableRow key={band.id}>
                <TableCell className="font-medium">{band.name}</TableCell>
                <TableCell className="text-right text-fm-fg-muted">
                  {fmt.format(band.balance)}
                </TableCell>
                <TableCell className="text-right text-fm-good">{fmt.format(band.income)}</TableCell>
                <TableCell className="text-right text-fm-bad">{fmt.format(band.expenses)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {band.profit >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-fm-good" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-fm-bad" />
                    )}
                    <span className={band.profit >= 0 ? "text-fm-good" : "text-fm-bad"}>
                      {fmt.format(band.profit)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold text-fm-good">
                  {fmt.format(band.playerShare)}
                </TableCell>
              </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="grid gap-3 md:grid-cols-3" aria-label="Band treasury summary cards">
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Reserve target progress</p><p className="font-semibold">Tracked by band finance policy</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Awaiting approvals</p><p className="font-semibold">Withdrawals and reimbursements</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Permissions</p><p className="font-semibold flex items-center gap-1"><ShieldCheck className="h-4 w-4" /> Role-based actions</p></div>
        </div>

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
