import { AlertCircle, Loader2, ReceiptText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFinancialHistory } from "@/hooks/useFinancialHistory";

const money = (value: number, currency = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const FinancialHistoryLedger = () => {
  const { data, isLoading, error } = useFinancialHistory(25);
  if (isLoading) return <Card><CardContent className="flex min-h-40 items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading financial history…</CardContent></Card>;
  if (error) return <Card className="border-destructive/40"><CardContent className="flex min-h-40 items-center justify-center gap-2 text-destructive"><AlertCircle className="h-4 w-4" /> Could not load financial history.</CardContent></Card>;
  const currency = data?.account.default_currency_code ?? "USD";
  return <div className="space-y-4">
    <div className="grid gap-3 md:grid-cols-3">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Current balance</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{money(data?.account.currentBalance ?? 0, currency)}</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Available</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-fm-good">{money(data?.account.availableBalance ?? 0, currency)}</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Reserved</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-muted-foreground">{money(data?.account.reservedBalance ?? 0, currency)}</CardContent></Card>
    </div>
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><ReceiptText className="h-4 w-4" /> Recent ledger transactions</CardTitle></CardHeader>
      <CardContent>
        {!data?.transactions.length ? <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">No ledger transactions yet.</div> :
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Description</th><th className="py-2 pr-3">Category</th><th className="py-2 pr-3 text-right">Money in</th><th className="py-2 pr-3 text-right">Money out</th><th className="py-2">Status</th></tr></thead><tbody>{data.transactions.map((tx: any) => <tr key={tx.id} className="border-b last:border-0"><td className="whitespace-nowrap py-3 pr-3 text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</td><td className="min-w-48 py-3 pr-3">{tx.description ?? "Financial transaction"}</td><td className="py-3 pr-3"><Badge variant="outline">{label(tx.transaction_category)}</Badge></td><td className="py-3 pr-3 text-right text-fm-good">{tx.moneyIn ? money(tx.moneyIn, currency) : "—"}</td><td className="py-3 pr-3 text-right text-fm-bad">{tx.moneyOut ? money(tx.moneyOut, currency) : "—"}</td><td className="py-3"><Badge>{label(tx.status)}</Badge></td></tr>)}</tbody></table></div>}
      </CardContent>
    </Card>
  </div>;
};
