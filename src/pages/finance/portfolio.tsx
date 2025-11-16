import { useEffect, useMemo, useState } from "react";

import { IncomeExpenseChart } from "@/components/finance/IncomeExpenseChart";
import { InvestmentAllocation } from "@/components/finance/InvestmentAllocation";
import { InvestmentPerformance } from "@/components/finance/InvestmentPerformance";
import { PortfolioSummary } from "@/components/finance/PortfolioSummary";
import { TransactionHistory } from "@/components/finance/TransactionHistory";
import {
  calculatePortfolioPerformance,
  fetchInvestmentPositions,
  fetchMonthlyLedger,
  fetchTransactionHistory,
  type FinanceTransaction,
  type InvestmentPosition,
  type PortfolioPerformanceSummary,
} from "@/lib/api/finance";

const DEMO_CHARACTER_ID = "demo-character";
const LEDGER_MONTHS = 6;

const PortfolioPage = () => {
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [positions, setPositions] = useState<InvestmentPosition[]>([]);
  const [ledger, setLedger] = useState<Array<{ month: string; income: number; expenses: number }>>([]);
  const [performance, setPerformance] = useState<PortfolioPerformanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [txn, investmentPositions, ledgerData] = await Promise.all([
          fetchTransactionHistory(DEMO_CHARACTER_ID, { limit: 25 }),
          fetchInvestmentPositions(DEMO_CHARACTER_ID),
          fetchMonthlyLedger(DEMO_CHARACTER_ID, LEDGER_MONTHS),
        ]);

        if (!isMounted) {
          return;
        }

        setTransactions(txn);
        setPositions(investmentPositions);
        setLedger(ledgerData);
        setPerformance(calculatePortfolioPerformance(investmentPositions));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const { monthlyIncome, monthlyExpenses } = useMemo(() => {
    if (!ledger.length) {
      return { monthlyIncome: 0, monthlyExpenses: 0 };
    }

    const totalIncome = ledger.reduce((sum, item) => sum + item.income, 0);
    const totalExpenses = ledger.reduce((sum, item) => sum + item.expenses, 0);
    const monthsCount = Math.max(ledger.length, 1);

    return {
      monthlyIncome: totalIncome / monthsCount,
      monthlyExpenses: totalExpenses / monthsCount,
    };
  }, [ledger]);

  const cashReserve = useMemo(
    () => positions.filter((position) => position.category === "Cash").reduce((sum, position) => sum + position.currentValue, 0),
    [positions],
  );

  const summary = performance ?? {
    totalInvested: 0,
    totalCurrentValue: 0,
    netGain: 0,
    roi: 0,
    annualizedRoi: 0,
    positions: [],
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Portfolio Intelligence</h1>
        <p className="text-muted-foreground">
          Visualize your income engines, expense commitments, and investment performance in one collaborative workspace.
        </p>
      </div>

      <PortfolioSummary
        netWorth={summary.totalCurrentValue}
        invested={summary.totalInvested}
        cashReserve={cashReserve}
        monthlyIncome={monthlyIncome}
        monthlyExpenses={monthlyExpenses}
        portfolioRoi={summary.roi}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <IncomeExpenseChart data={ledger} />
        </div>
        <InvestmentAllocation positions={positions} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <InvestmentPerformance summary={summary} />
        </div>
        <TransactionHistory transactions={transactions} limit={12} />
      </div>

      {isLoading && !transactions.length && (
        <p className="text-center text-sm text-muted-foreground">Loading portfolio insights…</p>
      )}
    </div>
  );
};

export default PortfolioPage;

