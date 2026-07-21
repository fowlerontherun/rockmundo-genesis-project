import { useQuery } from "@tanstack/react-query";
import { Bell, CalendarClock, Landmark, Loader2, PiggyBank, Target, TrendingUp, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { fetchBankingDashboard, formatCurrencyMinor } from "@/services/banking/bankingService";

function getBankingErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Banking is temporarily unavailable.";
}

export default function Banking() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["banking-dashboard"],
    queryFn: fetchBankingDashboard,
  });

  return (
    <FMPageScaffold title="Banking" subtitle="Manage current accounts, savings, fixed deposits, goals, statements and reusable liquidity foundations." icon={Landmark} backTo="/finances">
      {isLoading ? (
        <div className="flex min-h-[320px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : error ? (
        <Card><CardHeader><CardTitle>Banking unavailable</CardTitle><CardDescription>{getBankingErrorMessage(error)}</CardDescription></CardHeader><CardContent><Button onClick={() => void refetch()}>Retry</Button></CardContent></Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><WalletCards className="h-5 w-5" /> Net worth</CardTitle><CardDescription>Cash and savings across supported currencies.</CardDescription></CardHeader><CardContent className="text-3xl font-bold">{formatCurrencyMinor({ amountMinor: data?.savingsSummary?.netWorthMinor ?? data?.accounts.reduce((sum, account) => sum + account.balanceMinor, 0) ?? 0, currencyCode: data?.savingsSummary?.currencyCode ?? data?.accounts[0]?.currencyCode ?? "USD" })}</CardContent></Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><PiggyBank className="h-5 w-5" /> Savings</CardTitle><CardDescription>Easy access, premium and reserve balances.</CardDescription></CardHeader><CardContent className="text-3xl font-bold">{formatCurrencyMinor({ amountMinor: data?.savingsSummary?.savingsMinor ?? 0, currencyCode: data?.savingsSummary?.currencyCode ?? "USD" })}</CardContent></Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5" /> Locked deposits</CardTitle><CardDescription>Next maturity {data?.savingsSummary?.nextMaturityDate ?? "not scheduled"}.</CardDescription></CardHeader><CardContent className="text-3xl font-bold">{formatCurrencyMinor({ amountMinor: data?.savingsSummary?.lockedDepositsMinor ?? 0, currencyCode: data?.savingsSummary?.currencyCode ?? "USD" })}</CardContent></Card>
          </div>

          <section className="grid gap-4 lg:grid-cols-3">
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Interest</CardTitle><CardDescription>Accrued daily, posted monthly through balanced journals.</CardDescription></CardHeader><CardContent><p className="text-2xl font-bold">{formatCurrencyMinor({ amountMinor: data?.savingsSummary?.monthlyInterestMinor ?? 0, currencyCode: data?.savingsSummary?.currencyCode ?? "USD" })}</p><p className="text-sm text-muted-foreground">YTD {formatCurrencyMinor({ amountMinor: data?.savingsSummary?.interestEarnedYtdMinor ?? 0, currencyCode: data?.savingsSummary?.currencyCode ?? "USD" })}</p></CardContent></Card>
            <Card><CardHeader><CardTitle>Cash flow health</CardTitle><CardDescription>Income, expenses and savings-rate indicators.</CardDescription></CardHeader><CardContent><p className="text-2xl font-bold capitalize">{data?.cashFlowAnalytics?.financialHealth ?? "building"}</p><p className="text-sm text-muted-foreground">Savings rate {Math.round((data?.cashFlowAnalytics?.savingsRateBps ?? 0) / 100)}%</p></CardContent></Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Notifications</CardTitle><CardDescription>Interest, maturity, minimum-balance and rate alerts.</CardDescription></CardHeader><CardContent><p className="text-2xl font-bold">{data?.notifications?.length ?? 0}</p><p className="text-sm text-muted-foreground">Latest banking alerts</p></CardContent></Card>
          </section>

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

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" /> Savings goals</CardTitle><CardDescription>Goals can receive scheduled or threshold-based transfers.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {data?.savingsGoals?.length ? data.savingsGoals.map((goal) => (
                  <div key={goal.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between"><strong>{goal.name}</strong><span className="text-sm text-muted-foreground">{Math.round(goal.completionBps / 100)}%</span></div>
                    <div className="mt-2 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, goal.completionBps / 100)}%` }} /></div>
                    <p className="mt-2 text-sm text-muted-foreground">{formatCurrencyMinor({ amountMinor: goal.currentMinor, currencyCode: goal.currencyCode })} of {formatCurrencyMinor({ amountMinor: goal.targetMinor, currencyCode: goal.currencyCode })}</p>
                  </div>
                )) : <p className="text-sm text-muted-foreground">No savings goals yet. Create goals for a new guitar, tour bus, studio or house deposit.</p>}
              </CardContent>
            </Card>
          </section>
        </div>
      )}
    </FMPageScaffold>
  );
}