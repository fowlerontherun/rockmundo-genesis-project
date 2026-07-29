import { AlertCircle, Loader2, ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFinancialHistory } from "@/hooks/useFinancialHistory";
import { formatMoney } from "@/lib/financeFormatting";

const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export const FinancialHistoryLedger = () => {
  const { data, isLoading, error } = useFinancialHistory(25);
  if (isLoading) return <Card><CardContent className="flex min-h-40 items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading wallet history…</CardContent></Card>;
  if (error) return <Card className="border-destructive/40"><CardContent className="flex min-h-40 items-center justify-center gap-2 text-destructive"><AlertCircle className="h-4 w-4" /> Could not load wallet history.</CardContent></Card>;

  const currency = data?.account.default_currency_code ?? "GBP";
  const money = (value: number) => formatMoney(value, currency, 2);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">This tab shows the primary wallet only. Use Transactions for the combined wallet, bank and savings history.</p>
      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Current balance</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{money(data?.account.currentBalance ?? 0)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Available</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-fm-good">{money(data?.account.availableBalance ?? 0)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Reserved</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-muted-foreground">{money(data?.account.reservedBalance ?? 0)}</CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ReceiptText className="h-4 w-4" /> Recent wallet transactions</CardTitle></CardHeader>
        <CardContent>
          {!data?.transactions.length ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">No wallet transactions yet.</div>
          ) : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Description</th><th className="py-2 pr-3">Category</th><th className="py-2 pr-3 text-right">Money in</th><th className="py-2 pr-3 text-right">Money out</th><th className="py-2">Status</th></tr></thead><tbody>{data.transactions.map((transaction: any) => <tr key={transaction.id} className="border-b last:border-0"><td className="whitespace-nowrap py-3 pr-3 text-muted-foreground">{new Date(transaction.created_at).toLocaleDateString("en-GB")}</td><td className="min-w-48 py-3 pr-3">{transaction.description ?? "Financial transaction"}</td><td className="py-3 pr-3"><Badge variant="outline">{label(transaction.transaction_category)}</Badge></td><td className="py-3 pr-3 text-right text-fm-good">{transaction.moneyIn ? money(transaction.moneyIn) : "—"}</td><td className="py-3 pr-3 text-right text-fm-bad">{transaction.moneyOut ? money(transaction.moneyOut) : "—"}</td><td className="py-3"><Badge>{label(transaction.status)}</Badge></td></tr>)}</tbody></table></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
