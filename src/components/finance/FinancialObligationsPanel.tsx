import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { loadFinancialObligationsDashboard, type CreditHistoryEvent, type CreditScore, type DebtRecord, type FinancialObligation, type ObligationScheduleLine } from "@/services/banking/financialObligations";

const money = (amount: number, currency: string | null = "GBP") => new Intl.NumberFormat("en-GB", { style: "currency", currency: currency ?? "GBP" }).format(amount / 100);

type State = { obligations: FinancialObligation[]; schedule: ObligationScheduleLine[]; debts: DebtRecord[]; creditHistory: CreditHistoryEvent[]; creditScore: CreditScore | null };

export function FinancialObligationsPanel({ profileId }: { profileId?: string }) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadFinancialObligationsDashboard(profileId).then((data) => { if (alive) setState(data); }).catch((err) => { if (alive) setError(err.message ?? "Unable to load obligations"); });
    return () => { alive = false; };
  }, [profileId]);

  if (error) return <Card><CardHeader><CardTitle>Financial obligations</CardTitle><CardDescription>{error}</CardDescription></CardHeader></Card>;
  if (!state) return <Card><CardHeader><CardTitle>Financial obligations</CardTitle><CardDescription>Loading universal payment schedule…</CardDescription></CardHeader></Card>;

  return <div className="grid gap-6 lg:grid-cols-2">
    <Card><CardHeader><CardTitle>Upcoming payments</CardTitle><CardDescription>Universal obligations engine covering mortgages, rent, loans, insurance and future recurring bills.</CardDescription></CardHeader><CardContent className="space-y-3">{state.obligations.length === 0 ? <p className="text-sm text-muted-foreground">No active obligations yet.</p> : state.obligations.map((o) => <div key={o.id} className="rounded-lg border p-3"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold capitalize">{o.obligation_type.replaceAll("_", " ")}</p><p className="text-sm text-muted-foreground">Due {o.next_due_date} · {o.frequency} · grace {o.grace_period_days} days</p></div><Badge variant={o.status === "active" ? "default" : "secondary"}>{o.status}</Badge></div><p className="mt-2 text-sm">{money(o.amount_minor, o.currency_code)} due · {money(o.outstanding_balance_minor, o.currency_code)} outstanding · {o.missed_payment_count} missed</p></div>)}</CardContent></Card>
    <Card><CardHeader><CardTitle>Credit profile</CardTitle><CardDescription>Private server-side score and non-public credit events.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="rounded-lg border p-3"><p className="text-2xl font-bold">{state.creditScore?.credit_score ?? "—"}</p><p className="text-sm text-muted-foreground">{state.creditScore?.credit_band ?? "Building"}</p></div>{state.creditHistory.slice(0, 5).map((e) => <div key={e.id} className="flex justify-between text-sm"><span className="capitalize">{e.event_type.replaceAll("_", " ")}</span><span>{e.event_date} · {e.score_delta > 0 ? "+" : ""}{e.score_delta}</span></div>)}</CardContent></Card>
    <Card><CardHeader><CardTitle>Payment history</CardTitle></CardHeader><CardContent className="space-y-2">{state.schedule.slice(0, 8).map((s) => <div key={s.id} className="flex justify-between text-sm"><span>{s.due_date}</span><span>{money(s.amount_minor)} · {s.status}</span></div>)}</CardContent></Card>
    <Card><CardHeader><CardTitle>Debt recovery</CardTitle><CardDescription>Configurable collection stages from reminder through recovery.</CardDescription></CardHeader><CardContent className="space-y-2">{state.debts.length === 0 ? <p className="text-sm text-muted-foreground">No open player debts.</p> : state.debts.map((d) => <div key={d.id} className="rounded-lg border p-3 text-sm"><p className="font-medium capitalize">{d.collection_stage.replaceAll("_", " ")}</p><p>{money(d.outstanding_balance_minor, d.currency_code)} outstanding · {d.status}</p></div>)}</CardContent></Card>
  </div>;
}
