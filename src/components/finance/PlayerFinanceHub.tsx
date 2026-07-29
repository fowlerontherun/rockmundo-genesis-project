import { ArrowDownRight, ArrowLeftRight, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FinancialSummary, FinancialTransaction } from "@/hooks/useFinances";
import { formatMoney } from "@/lib/financeFormatting";

export function PlayerFinanceHub({
  summary,
  transactions,
}: {
  summary: FinancialSummary;
  transactions: FinancialTransaction[];
}) {
  const money = (amount: number) => formatMoney(amount, summary.currencyCode);
  const netMonthly = summary.monthlyIncome - summary.monthlyExpenses;
  const recent = transactions.slice(0, 12);

  return (
    <div className="space-y-6" aria-label="Personal finance hub">
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <FinanceMetric label="Wallet cash" value={money(summary.cash)} />
        <FinanceMetric label="Personal accounts" value={money(summary.personalAccounts)} />
        <FinanceMetric label="Average monthly income" value={money(summary.monthlyIncome)} tone="good" />
        <FinanceMetric label="Average monthly expenses" value={money(summary.monthlyExpenses)} tone="bad" />
        <FinanceMetric label="Average monthly net" value={money(netMonthly)} tone={netMonthly >= 0 ? "good" : "bad"} />
        <FinanceMetric label="Canonical liabilities" value={money(summary.totalLoans)} tone={summary.totalLoans > 0 ? "bad" : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>All-time external cash flow</CardTitle><CardDescription>Internal account transfers are excluded.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">External income</p><p className="text-xl font-semibold text-fm-good">{money(summary.totalEarnings)}</p></div>
            <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">External spending</p><p className="text-xl font-semibold text-fm-bad">{money(summary.totalExpenses)}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Personal wealth boundary</CardTitle><CardDescription>Only balances in {summary.currencyCode} enter the headline total.</CardDescription></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Personal accounts</span><span>{money(summary.personalAccounts)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Investments</span><span>{money(summary.investmentValue)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Less liabilities</span><span className="text-fm-bad">-{money(summary.totalLoans)}</span></div>
            <div className="flex justify-between border-t pt-2 font-semibold"><span>Personal net worth</span><span>{money(summary.netWorth)}</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent canonical activity</CardTitle><CardDescription>Wallet, bank, savings and external transactions in one history.</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {recent.length ? recent.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{new Date(transaction.date).toLocaleDateString("en-GB")}</TableCell>
                  <TableCell>{transaction.description ?? transaction.source}</TableCell>
                  <TableCell>
                    {transaction.type === "income" ? <Badge variant="outline" className="text-fm-good"><ArrowUpRight className="mr-1 h-3 w-3" />Income</Badge> : transaction.type === "expense" ? <Badge variant="outline" className="text-fm-bad"><ArrowDownRight className="mr-1 h-3 w-3" />Expense</Badge> : <Badge variant="outline"><ArrowLeftRight className="mr-1 h-3 w-3" />Transfer</Badge>}
                  </TableCell>
                  <TableCell className="text-right">{formatMoney(transaction.amount, transaction.currencyCode)}</TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">No canonical activity yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function FinanceMetric({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return <Card><CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle className={tone === "good" ? "text-fm-good" : tone === "bad" ? "text-fm-bad" : undefined}>{value}</CardTitle></CardHeader></Card>;
}
