import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ArrowDownRight, ArrowLeftRight, ArrowUpRight, Circle, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FMFilterBar, type FilterPill } from "@/components/fm/FMFilterBar";
import type { FinancialTransaction, FinancialTransactionType } from "@/hooks/useFinances";
import { formatMoney } from "@/lib/financeFormatting";

const SOURCE_LABELS: Record<string, string> = {
  gig_performance: "Gig Performance",
  recording: "Recording",
  release: "Release Revenue",
  bank_transfer: "Account Transfer",
  bank_deposit: "Bank Deposit",
  bank_withdrawal: "Bank Withdrawal",
  merchandise: "Merchandise",
  streaming: "Streaming",
  manufacturing: "Manufacturing",
  marketing: "Marketing",
  equipment: "Equipment",
  travel: "Travel",
};

const labelFor = (source: string) =>
  SOURCE_LABELS[source] || source.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

interface TransactionsListProps {
  transactions: FinancialTransaction[];
  currencyCode: string;
}

type TypeFilter = "all" | FinancialTransactionType;

const TypeBadge = ({ type }: { type: FinancialTransactionType }) => {
  if (type === "income") return <Badge variant="outline" className="text-fm-good border-fm-good/30"><ArrowUpRight className="mr-1 h-3 w-3" />Income</Badge>;
  if (type === "expense") return <Badge variant="outline" className="text-fm-bad border-fm-bad/30"><ArrowDownRight className="mr-1 h-3 w-3" />Expense</Badge>;
  if (type === "transfer") return <Badge variant="outline" className="text-blue-500 border-blue-500/30"><ArrowLeftRight className="mr-1 h-3 w-3" />Transfer</Badge>;
  return <Badge variant="outline"><Circle className="mr-1 h-2.5 w-2.5" />Activity</Badge>;
};

export const TransactionsList = ({ transactions, currencyCode }: TransactionsListProps) => {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(25);

  const counts = useMemo(() => {
    const result = { all: transactions.length, income: 0, expense: 0, transfer: 0, other: 0 };
    transactions.forEach((transaction) => { result[transaction.type] += 1; });
    return result;
  }, [transactions]);

  const sources = useMemo(() => Array.from(new Set(transactions.map((transaction) => transaction.source))).sort(), [transactions]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transactions.filter((transaction) => {
      if (typeFilter !== "all" && transaction.type !== typeFilter) return false;
      if (sourceFilter !== "all" && transaction.source !== sourceFilter) return false;
      if (!query) return true;
      return `${transaction.description ?? ""} ${transaction.bandName ?? ""} ${labelFor(transaction.source)}`.toLowerCase().includes(query);
    });
  }, [transactions, typeFilter, sourceFilter, search]);

  const totalIncome = filtered.filter((item) => item.type === "income" && item.externalCashFlow).reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = filtered.filter((item) => item.type === "expense" && item.externalCashFlow).reduce((sum, item) => sum + item.amount, 0);
  const visible = filtered.slice(0, limit);
  const pills: FilterPill<TypeFilter>[] = [
    { value: "all", label: "All", count: counts.all },
    { value: "income", label: "Income", count: counts.income },
    { value: "expense", label: "Expense", count: counts.expense },
    { value: "transfer", label: "Transfers", count: counts.transfer },
  ];

  if (!transactions.length) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Transaction History</CardTitle><CardDescription>Canonical financial activity</CardDescription></CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center"><div className="text-center"><History className="mx-auto h-8 w-8 text-fm-fg-muted/50" /><p className="mt-2 text-xs text-fm-fg-muted">No canonical transactions yet.</p></div></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Transaction History</CardTitle>
        <CardDescription>
          {formatMoney(totalIncome, currencyCode)} external income • {formatMoney(totalExpenses, currencyCode)} external spending
          {filtered.length !== transactions.length && <> • {filtered.length} of {transactions.length} shown</>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <FMFilterBar
          label="Filter"
          search={search}
          onSearchChange={(value) => { setSearch(value); setLimit(25); }}
          searchPlaceholder="Search description, source or band…"
          pills={pills}
          activePill={typeFilter}
          onPillChange={(value) => { setTypeFilter(value as TypeFilter); setLimit(25); }}
          right={
            <select value={sourceFilter} onChange={(event) => { setSourceFilter(event.target.value); setLimit(25); }} className="h-6 rounded-sm border border-fm-border bg-fm-panel px-1.5 text-xs text-fm-fg focus:border-fm-accent focus:outline-none">
              <option value="all">All sources</option>
              {sources.map((source) => <option key={source} value={source}>{labelFor(source)}</option>)}
            </select>
          }
        />

        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Source</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
          <TableBody>
            {!visible.length ? (
              <TableRow><TableCell colSpan={5} className="py-6 text-center text-fm-fg-muted">No transactions match your filters.</TableCell></TableRow>
            ) : visible.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell className="text-fm-fg-muted">{format(new Date(transaction.date), "dd MMM yyyy")}</TableCell>
                <TableCell><TypeBadge type={transaction.type} /></TableCell>
                <TableCell className="font-medium">{labelFor(transaction.source)}</TableCell>
                <TableCell className="max-w-[240px] truncate text-fm-fg-muted">{transaction.description || transaction.bandName || "—"}</TableCell>
                <TableCell className={`text-right font-semibold ${transaction.type === "income" ? "text-fm-good" : transaction.type === "expense" ? "text-fm-bad" : "text-foreground"}`}>
                  {transaction.type === "income" ? "+" : transaction.type === "expense" ? "-" : ""}{formatMoney(transaction.amount, transaction.currencyCode)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filtered.length > limit && <div className="mt-2 text-center"><Button variant="outline" size="sm" onClick={() => setLimit((current) => current + 25)}>Load More ({filtered.length - limit} remaining)</Button></div>}
      </CardContent>
    </Card>
  );
};
