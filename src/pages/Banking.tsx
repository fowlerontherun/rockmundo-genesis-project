import { useQuery } from "@tanstack/react-query";
import { Landmark, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { fetchBankingDashboard, formatCurrencyMinor } from "@/services/banking/bankingService";

export default function Banking() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["banking-dashboard"],
    queryFn: fetchBankingDashboard,
  });

  return (
    <FMPageScaffold title="Banking" subtitle="Open accounts, apply for credit, and manage declining-payment loans." icon={Landmark} backTo="/finances">
      {isLoading ? (
        <div className="flex min-h-[320px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : error ? (
        <Card><CardHeader><CardTitle>Banking unavailable</CardTitle><CardDescription>{String(error)}</CardDescription></CardHeader><CardContent><Button onClick={() => void refetch()}>Retry</Button></CardContent></Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card><CardHeader><CardTitle>Accounts</CardTitle><CardDescription>Balances stay separated by currency.</CardDescription></CardHeader><CardContent className="text-3xl font-bold">{data?.accounts.length ?? 0}</CardContent></Card>
            <Card><CardHeader><CardTitle>Active borrowing</CardTitle><CardDescription>Next unpaid schedule line drives payment summaries.</CardDescription></CardHeader><CardContent className="text-3xl font-bold">{data?.loans.length ?? 0}</CardContent></Card>
            <Card><CardHeader><CardTitle>Credit band</CardTitle><CardDescription>Guidance without exposing scoring internals.</CardDescription></CardHeader><CardContent className="text-3xl font-bold">{data?.creditProfile?.band ?? "—"}</CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Borrow</CardTitle><CardDescription>Guided applications use server-generated affordability snapshots and disclose equal-principal, declining payments.</CardDescription></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Button asChild><Link to="/finance/banking/apply">Start loan application</Link></Button>
              <Button variant="outline" asChild><Link to="/finances?tab=loans">Compare existing loan offers</Link></Button>
            </CardContent>
          </Card>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Accounts</CardTitle><CardDescription>Current, savings, restricted, and currency accounts.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {data?.accounts.length ? data.accounts.map((account) => (
                  <div key={account.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2"><strong>{account.providerName}</strong><Badge>{account.currencyCode}</Badge></div>
                    <p className="text-sm text-muted-foreground">{account.accountType} · {account.restrictionSummary ?? "Unrestricted"}</p>
                    <p className="text-lg font-semibold">{formatCurrencyMinor({ amountMinor: account.balanceMinor, currencyCode: account.currencyCode })}</p>
                  </div>
                )) : <p className="text-sm text-muted-foreground">No linked bank accounts yet.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Active loans</CardTitle><CardDescription>Principal, interest and fees are presented as separate components.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {data?.loans.length ? data.loans.map((loan) => (
                  <Link key={loan.id} to={`/finance/banking/loans/${loan.id}`} className="block rounded-lg border p-3 hover:bg-muted/40">
                    <div className="flex items-center justify-between gap-2"><strong>{loan.providerName}</strong><Badge variant={loan.overdueMinor > 0 ? "destructive" : "secondary"}>{loan.status}</Badge></div>
                    <p className="text-sm text-muted-foreground">Outstanding {formatCurrencyMinor({ amountMinor: loan.outstandingPrincipalMinor, currencyCode: loan.currencyCode })}</p>
                    <p className="text-sm">Next payment: {formatCurrencyMinor({ amountMinor: loan.nextPaymentMinor, currencyCode: loan.currencyCode })} {loan.nextPaymentDate ? `on ${loan.nextPaymentDate}` : ""}</p>
                  </Link>
                )) : <p className="text-sm text-muted-foreground">No active loans.</p>}
              </CardContent>
            </Card>
          </section>
        </div>
      )}
    </FMPageScaffold>
  );
}