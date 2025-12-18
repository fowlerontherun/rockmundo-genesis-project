import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFinances } from "@/hooks/useFinances";
import { FinanceSummaryCards } from "@/components/finance/FinanceSummaryCards";
import { IncomeBreakdownChart } from "@/components/finance/IncomeBreakdownChart";
import { BandFinancesCard } from "@/components/finance/BandFinancesCard";
import { InvestmentsTab } from "@/components/finance/InvestmentsTab";
import { LoansTab } from "@/components/finance/LoansTab";
import { TransactionsList } from "@/components/finance/TransactionsList";
import { Loader2 } from "lucide-react";

const Finances = () => {
  const { 
    bands, 
    transactions, 
    investments, 
    loans, 
    summary,
    earningsBySource,
    loanOffers,
    investmentOptions,
    isLoading,
  } = useFinances();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Financial Command Center</h1>
        <p className="text-muted-foreground">
          Monitor personal and band finances, track investments, and explore funding pathways to keep your music dreams funded.
        </p>
      </div>

      {/* Summary Cards */}
      <FinanceSummaryCards summary={summary} />

      {/* Main Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="bands">Bands</TabsTrigger>
          <TabsTrigger value="investments">Investments</TabsTrigger>
          <TabsTrigger value="loans">Loans</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Income Breakdown Chart */}
            <IncomeBreakdownChart earningsBySource={earningsBySource} />
            
            {/* Band Overview */}
            <BandFinancesCard bands={bands} />
          </div>

          {/* Recent Transactions */}
          <TransactionsList transactions={transactions.slice(0, 10)} />
        </TabsContent>

        <TabsContent value="bands" className="space-y-6">
          <BandFinancesCard bands={bands} />
        </TabsContent>

        <TabsContent value="investments" className="space-y-6">
          <InvestmentsTab 
            investments={investments} 
            investmentOptions={investmentOptions}
            cash={summary.cash}
          />
        </TabsContent>

        <TabsContent value="loans" className="space-y-6">
          <LoansTab 
            loans={loans} 
            loanOffers={loanOffers}
            cash={summary.cash}
          />
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          <TransactionsList transactions={transactions} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Finances;
