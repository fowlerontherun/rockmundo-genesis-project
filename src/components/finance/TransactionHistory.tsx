import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FinanceTransaction } from "@/lib/api/finance";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

interface TransactionHistoryProps {
  transactions: FinanceTransaction[];
  limit?: number;
}

const typeVariant: Record<FinanceTransaction["type"], "default" | "secondary" | "destructive"> = {
  income: "default",
  expense: "destructive",
  investment: "secondary",
};

const typeLabel: Record<FinanceTransaction["type"], string> = {
  income: "Income",
  expense: "Expense",
  investment: "Investment",
};

export const TransactionHistory = ({ transactions, limit = 10 }: TransactionHistoryProps) => {
  const visibleTransactions = useMemo(() => transactions.slice(0, limit), [transactions, limit]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest inflows and outflows shaping your financial trajectory.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleTransactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell className="whitespace-nowrap">
                  {dateFormatter.format(new Date(transaction.date))}
                </TableCell>
                <TableCell>
                  <Badge variant={typeVariant[transaction.type]}>{typeLabel[transaction.type]}</Badge>
                </TableCell>
                <TableCell className="font-medium">{transaction.category}</TableCell>
                <TableCell className="text-muted-foreground">
                  {transaction.description ?? "—"}
                </TableCell>
                <TableCell className={`text-right font-medium ${transaction.type === "expense" ? "text-destructive" : ""}`}>
                  {transaction.type === "expense" ? "-" : "+"}
                  {currencyFormatter.format(transaction.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

