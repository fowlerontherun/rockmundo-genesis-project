import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FinancialSummary, FinancialTransaction } from "@/hooks/useFinances";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const incomeCategories = ["Wages", "Gig earnings", "Royalties", "Streaming", "Merchandise", "Songwriting", "Session work", "Teaching", "Company dividends", "Player transfers", "Administrative grants", "Other income"];
const expenseCategories = ["Rent", "Travel", "Accommodation", "Food or lifestyle", "Rehearsals", "Recording", "Equipment", "Repairs", "Education", "Band contributions", "Taxes", "Fees", "Subscriptions", "Debt payments", "Other spending"];

export function PlayerFinanceHub({ summary, transactions }: { summary: FinancialSummary; transactions: FinancialTransaction[] }) {
  const weeklyIncome = transactions.filter((t) => t.type === "income").slice(0, 20).reduce((sum, t) => sum + t.amount, 0);
  const weeklyExpenses = transactions.filter((t) => t.type === "expense").slice(0, 20).reduce((sum, t) => sum + t.amount, 0);
  const upcoming = transactions.filter((t) => t.type === "expense").slice(0, 3);
  return (
    <div className="space-y-6" aria-label="Personal finance hub">
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <FinanceMetric label="Available cash" value={money.format(summary.cash)} />
        <FinanceMetric label="Reserved" value={money.format(Math.max(0, summary.totalLoans / 12))} />
        <FinanceMetric label="Weekly income" value={money.format(weeklyIncome)} tone="good" />
        <FinanceMetric label="Weekly expenses" value={money.format(weeklyExpenses)} tone="bad" />
        <FinanceMetric label="Net cash flow" value={money.format(weeklyIncome - weeklyExpenses)} />
        <FinanceMetric label="Taxable this period" value={money.format(weeklyIncome)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Income breakdown</CardTitle><CardDescription>Extensible categories; only connected ledger sources show values.</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap gap-2">{incomeCategories.map((c) => <Badge key={c} variant="secondary">{c}</Badge>)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Expense breakdown</CardTitle><CardDescription>Recurring obligations and ledger categories feed this view.</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap gap-2">{expenseCategories.map((c) => <Badge key={c} variant="outline">{c}</Badge>)}</CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Upcoming confirmed expenses</CardTitle><CardDescription>Shows due payments, auto-pay status and current recoverability once obligations exist.</CardDescription></CardHeader>
        <CardContent>
          <Table><TableHeader><TableRow><TableHead>Due</TableHead><TableHead>Description</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>
            {upcoming.length ? upcoming.map((t) => <TableRow key={t.id}><TableCell>{new Date(t.date).toLocaleDateString()}</TableCell><TableCell>{t.description ?? t.source}</TableCell><TableCell>{t.source}</TableCell><TableCell className="text-right">{money.format(t.amount)}</TableCell><TableCell><Badge>Scheduled</Badge></TableCell></TableRow>) : <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No upcoming obligations yet.</TableCell></TableRow>}
          </TableBody></Table></CardContent>
      </Card>
    </div>
  );
}

function FinanceMetric({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return <Card><CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle className={tone === "good" ? "text-fm-good" : tone === "bad" ? "text-fm-bad" : undefined}>{value}</CardTitle></CardHeader></Card>;
}
