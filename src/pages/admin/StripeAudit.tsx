import { useMemo, useState } from "react";
import { AdminRoute } from "@/components/AdminRoute";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CreditCard, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

type StripeTransaction = {
  id: string;
  created: string;
  type: string;
  amount: number;
  fee: number;
  net: number;
  currency: string;
  status: string;
  description: string | null;
  reporting_category: string | null;
  source: string | null;
};

type AuditResponse = {
  transactions: StripeTransaction[];
  summary: { gross: number; fees: number; net: number; count: number };
  has_more: boolean;
  next_cursor: string | null;
  range: { from: string | null; to: string | null };
};

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(minor / 100);

const StripeAudit = () => {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }, []);

  const [from, setFrom] = useState(thirtyDaysAgo);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<AuditResponse | null>(null);
  const [rows, setRows] = useState<StripeTransaction[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (next = false) => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: invokeError } = await supabase.functions.invoke("admin-stripe-audit", {
        body: { from: from || null, to: to || null, starting_after: next ? cursor : null },
      });
      if (invokeError) throw invokeError;
      const payload = result as AuditResponse;
      setData(payload);
      setRows((prev) => next ? [...prev, ...payload.transactions] : payload.transactions);
      setCursor(payload.next_cursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load Stripe audit data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminRoute>
      <div className="container mx-auto space-y-6 p-4 md:p-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold"><CreditCard className="h-7 w-7" /> Stripe Audit</h1>
            <p className="text-muted-foreground">Read-only live Stripe balance transactions, fees and net settlement values.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Transaction date filter</CardTitle>
            <CardDescription>Dates are interpreted as UTC and the endpoint is restricted to Rockmundo admins.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div className="space-y-2"><Label htmlFor="stripe-from">From</Label><Input id="stripe-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="stripe-to">To</Label><Input id="stripe-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <Button onClick={() => load(false)} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Load</Button>
          </CardContent>
        </Card>

        {error ? <Card className="border-destructive"><CardContent className="pt-6 text-destructive">{error}</CardContent></Card> : null}

        {data ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Transactions (page)</p><p className="text-2xl font-bold">{data.summary.count}</p></CardContent></Card>
              <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Gross</p><p className="text-2xl font-bold">{money(data.summary.gross, rows[0]?.currency ?? "gbp")}</p></CardContent></Card>
              <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Fees</p><p className="text-2xl font-bold">{money(data.summary.fees, rows[0]?.currency ?? "gbp")}</p></CardContent></Card>
              <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Net</p><p className="text-2xl font-bold">{money(data.summary.net, rows[0]?.currency ?? "gbp")}</p></CardContent></Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Stripe balance transactions</CardTitle><CardDescription>{rows.length} rows loaded. Source is Stripe live mode.</CardDescription></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-left"><th className="p-2">Date</th><th className="p-2">Type</th><th className="p-2">Description</th><th className="p-2 text-right">Gross</th><th className="p-2 text-right">Fee</th><th className="p-2 text-right">Net</th><th className="p-2">Status</th></tr></thead>
                    <tbody>
                      {rows.map((tx) => <tr key={tx.id} className="border-b align-top">
                        <td className="p-2 whitespace-nowrap">{new Date(tx.created).toLocaleString()}</td>
                        <td className="p-2"><div>{tx.type}</div><div className="text-xs text-muted-foreground">{tx.reporting_category ?? tx.id}</div></td>
                        <td className="p-2">{tx.description ?? tx.source ?? "—"}</td>
                        <td className="p-2 text-right whitespace-nowrap">{money(tx.amount, tx.currency)}</td>
                        <td className="p-2 text-right whitespace-nowrap">{money(tx.fee, tx.currency)}</td>
                        <td className="p-2 text-right whitespace-nowrap">{money(tx.net, tx.currency)}</td>
                        <td className="p-2"><Badge variant={tx.status === "available" ? "default" : "secondary"}>{tx.status}</Badge></td>
                      </tr>)}
                    </tbody>
                  </table>
                </div>
                {!rows.length ? <p className="py-6 text-center text-muted-foreground">No transactions in this date range.</p> : null}
                {data.has_more && cursor ? <Button className="mt-4" variant="outline" onClick={() => load(true)} disabled={loading}>Load more</Button> : null}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card><CardContent className="pt-6 text-muted-foreground">Choose a date range and load Stripe transactions.</CardContent></Card>
        )}
      </div>
    </AdminRoute>
  );
};

export default StripeAudit;
