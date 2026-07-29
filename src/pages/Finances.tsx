import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, DollarSign, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useFinances } from "@/hooks/useFinances";
import { FinanceSummaryCards } from "@/components/finance/FinanceSummaryCards";
import { IncomeBreakdownChart } from "@/components/finance/IncomeBreakdownChart";
import { IncomeExpenseChart } from "@/components/finance/IncomeExpenseChart";
import { SpendingCategoriesChart } from "@/components/finance/SpendingCategoriesChart";
import { BandFinanceDetail } from "@/components/finance/BandFinanceDetail";
import { PersonalFinanceBreakdown } from "@/components/finance/PersonalFinanceBreakdown";
import { TransactionsList } from "@/components/finance/TransactionsList";
import { SponsorshipTypesPanel } from "@/components/finance/SponsorshipTypesPanel";
import { CityTreasuryCard } from "@/components/finance/CityTreasuryCard";
import { FinancialHistoryLedger } from "@/components/finance/FinancialHistoryLedger";
import { PlayerFinanceHub } from "@/components/finance/PlayerFinanceHub";
import { CharityDonationsTab } from "@/components/finance/CharityDonationsTab";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { FinancialObligationsPanel } from "@/components/finance/FinancialObligationsPanel";
import {
  CanonicalInvestmentsPanel,
  CanonicalLoansPanel,
  OtherCurrencyBalancesPanel,
} from "@/components/finance/CanonicalFinanceHoldings";

const Finances = () => {
  const [searchParams] = useSearchParams();
  const {
    bands,
    transactions,
    investments,
    loans,
    summary,
    earningsBySource,
    monthlyLedger,
    otherCurrencyBalances,
    isLoading,
    error,
    refetch,
  } = useFinances();

  if (isLoading) {
    return (
      <FMPageScaffold title="Financial Command Center" icon={DollarSign} backTo="/career">
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </FMPageScaffold>
    );
  }

  if (error) {
    return (
      <FMPageScaffold title="Financial Command Center" icon={DollarSign} backTo="/career">
        <Card className="border-destructive/40">
          <CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div><p className="font-semibold">Financial data could not be loaded</p><p className="text-sm text-muted-foreground">The canonical finance dashboard did not return successfully.</p></div>
            <Button variant="outline" onClick={() => void refetch()}>Retry</Button>
          </CardContent>
        </Card>
      </FMPageScaffold>
    );
  }

  return (
    <FMPageScaffold
      title="Financial Command Center"
      subtitle="Canonical personal balances, cash flow, liabilities and separate band treasuries."
      icon={DollarSign}
      backTo="/career"
    >
      <FinanceSummaryCards summary={summary} />
      <OtherCurrencyBalancesPanel balances={otherCurrencyBalances} />

      <Tabs defaultValue={searchParams.get("tab") || "overview"} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="personal">Personal Hub</TabsTrigger>
          <TabsTrigger value="bands">Band Treasury</TabsTrigger>
          <TabsTrigger value="investments">Investments</TabsTrigger>
          <TabsTrigger value="loans">Loans</TabsTrigger>
          <TabsTrigger value="obligations">Obligations</TabsTrigger>
          <Button asChild size="sm" variant="outline"><Link to="/finance/banking">Banking</Link></Button>
          <Button asChild size="sm" variant="outline"><Link to="/finance/properties">Properties</Link></Button>
          <TabsTrigger value="charity">Charity</TabsTrigger>
          <TabsTrigger value="sponsorships">Sponsorships</TabsTrigger>
          <TabsTrigger value="city">City Treasury</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="ledger">Wallet Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <PersonalFinanceBreakdown summary={summary} />
            <BandFinanceDetail bands={bands} />
          </div>
          <IncomeExpenseChart data={monthlyLedger} currencyCode={summary.currencyCode} />
          <div className="grid gap-6 lg:grid-cols-2">
            <IncomeBreakdownChart earningsBySource={earningsBySource} currencyCode={summary.currencyCode} />
            <SpendingCategoriesChart transactions={transactions} currencyCode={summary.currencyCode} />
          </div>
          <TransactionsList transactions={transactions.slice(0, 10)} currencyCode={summary.currencyCode} />
        </TabsContent>

        <TabsContent value="personal" className="space-y-6">
          <PlayerFinanceHub summary={summary} transactions={transactions} />
        </TabsContent>

        <TabsContent value="bands" className="space-y-6">
          <BandFinanceDetail bands={bands} />
        </TabsContent>

        <TabsContent value="investments" className="space-y-6">
          <CanonicalInvestmentsPanel investments={investments} currencyCode={summary.currencyCode} />
        </TabsContent>

        <TabsContent value="loans" className="space-y-6">
          <CanonicalLoansPanel loans={loans} />
        </TabsContent>

        <TabsContent value="obligations" className="space-y-6">
          <FinancialObligationsPanel />
        </TabsContent>

        <TabsContent value="charity" className="space-y-6">
          <CharityDonationsTab cash={summary.cash} currencyCode={summary.currencyCode} />
        </TabsContent>

        <TabsContent value="sponsorships" className="space-y-6">
          <SponsorshipTypesPanel />
        </TabsContent>

        <TabsContent value="city" className="space-y-6">
          <CityTreasuryCard />
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          <TransactionsList transactions={transactions} currencyCode={summary.currencyCode} />
        </TabsContent>

        <TabsContent value="ledger" className="space-y-6">
          <FinancialHistoryLedger />
        </TabsContent>
      </Tabs>
    </FMPageScaffold>
  );
};

export default Finances;
