import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ArrowUpRight, ArrowDownRight, History } from "lucide-react";
import { FMFilterBar, type FilterPill } from "@/components/fm/FMFilterBar";
import type { FinancialTransaction } from "@/hooks/useFinances";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const SOURCE_LABELS: Record<string, string> = {
  gig_performance: "Gig Performance",
  recording: "Recording",
  release: "Release Revenue",
  deposit: "Direct Deposit",
  merchandise: "Merchandise",
  streaming: "Streaming",
  manufacturing: "Manufacturing",
  marketing: "Marketing",
  equipment: "Equipment",
  travel: "Travel",
};

const labelFor = (source: string) =>
  SOURCE_LABELS[source] || source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

interface TransactionsListProps {
  transactions: FinancialTransaction[];
}

type TypeFilter = "all" | "income" | "expense";

export const TransactionsList = ({ transactions }: TransactionsListProps) => {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(25);

  const counts = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      if (t.type === "income") income++;
      else if (t.type === "expense") expense++;
    }
    return { all: transactions.length, income, expense };
  }, [transactions]);

  const sources = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => set.add(t.source));
    return Array.from(set).sort();
  }, [transactions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (sourceFilter !== "all" && t.source !== sourceFilter) return false;
      if (!q) return true;
      const hay = `${t.description ?? ""} ${t.bandName ?? ""} ${labelFor(t.source)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [transactions, typeFilter, sourceFilter, search]);

  const totalIncome = filtered.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpenses = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  const visible = filtered.slice(0, limit);

  const pills: FilterPill<TypeFilter>[] = [
    { value: "all", label: "All", count: counts.all },
    { value: "income", label: "Income", count: counts.income },
    { value: "expense", label: "Expense", count: counts.expense },
  ];

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Transaction History
          </CardTitle>
          <CardDescription>Your financial activity</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center">
          <div className="text-center">
            <History className="mx-auto h-8 w-8 text-fm-fg-muted/50" />
            <p className="mt-2 text-xs text-fm-fg-muted">
              No transactions yet. Start earning to see your history.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-4 w-4" />
          Transaction History
        </CardTitle>
        <CardDescription>
          {currencyFormatter.format(totalIncome)} earned • {currencyFormatter.format(totalExpenses)} spent
          {filtered.length !== transactions.length && (
            <> • {filtered.length} of {transactions.length} shown</>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <FMFilterBar
          label="Filter"
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setLimit(25);
          }}
          searchPlaceholder="Search description, source, band…"
          pills={pills}
          activePill={typeFilter}
          onPillChange={(v) => {
            setTypeFilter(v);
            setLimit(25);
          }}
          right={
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setLimit(25);
              }}
              className="h-6 px-1.5 text-xs bg-fm-panel border border-fm-border rounded-sm text-fm-fg focus:outline-none focus:border-fm-accent"
            >
              <option value="all">All sources</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {labelFor(s)}
                </option>
              ))}
            </select>
          }
        />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-fm-fg-muted py-6">
                  No transactions match your filters.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-fm-fg-muted">
                    {format(new Date(t.date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    {t.type === "income" ? (
                      <Badge variant="outline" className="text-fm-good border-fm-good/30">
                        <ArrowUpRight className="mr-1 h-3 w-3" />
                        Income
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-fm-bad border-fm-bad/30">
                        <ArrowDownRight className="mr-1 h-3 w-3" />
                        Expense
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{labelFor(t.source)}</TableCell>
                  <TableCell className="text-fm-fg-muted max-w-[200px] truncate">
                    {t.description || t.bandName || "—"}
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold ${
                      t.type === "income" ? "text-fm-good" : "text-fm-bad"
                    }`}
                  >
                    {t.type === "income" ? "+" : "-"}
                    {currencyFormatter.format(t.amount)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {filtered.length > limit && (
          <div className="mt-2 text-center">
            <Button variant="outline" size="sm" onClick={() => setLimit(limit + 25)}>
              Load More ({filtered.length - limit} remaining)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
