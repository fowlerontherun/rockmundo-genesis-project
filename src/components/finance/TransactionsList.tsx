import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ArrowUpRight, ArrowDownRight, History } from "lucide-react";
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

interface TransactionsListProps {
  transactions: FinancialTransaction[];
}

export const TransactionsList = ({ transactions }: TransactionsListProps) => {
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [limit, setLimit] = useState(25);

  const filteredTransactions = transactions
    .filter((t) => filter === "all" || t.type === filter)
    .slice(0, limit);

  const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Transaction History
          </CardTitle>
          <CardDescription>Your financial activity</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center">
          <div className="text-center">
            <History className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Transaction History
            </CardTitle>
            <CardDescription>
              {currencyFormatter.format(totalIncome)} earned • {currencyFormatter.format(totalExpenses)} spent
            </CardDescription>
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expenses</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
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
            {filteredTransactions.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="text-muted-foreground">
                  {format(new Date(t.date), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  {t.type === "income" ? (
                    <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">
                      <ArrowUpRight className="mr-1 h-3 w-3" />
                      Income
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-destructive border-destructive/30">
                      <ArrowDownRight className="mr-1 h-3 w-3" />
                      Expense
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {SOURCE_LABELS[t.source] || t.source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-[200px] truncate">
                  {t.description || t.bandName || "—"}
                </TableCell>
                <TableCell className={`text-right font-semibold ${t.type === "income" ? "text-emerald-500" : "text-destructive"}`}>
                  {t.type === "income" ? "+" : "-"}{currencyFormatter.format(t.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {transactions.length > limit && (
          <div className="mt-4 text-center">
            <Button variant="outline" size="sm" onClick={() => setLimit(limit + 25)}>
              Load More
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
