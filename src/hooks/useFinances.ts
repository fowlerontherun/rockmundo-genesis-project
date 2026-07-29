import { useQuery } from "@tanstack/react-query";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import {
  fetchFinanceCommandCenter,
  type FinanceCommandBand,
  type FinanceCommandCenter,
} from "@/lib/api/financeCommandCenter";
import { fromMinorUnits } from "@/lib/financeFormatting";

export type FinancialTransactionType = "income" | "expense" | "transfer" | "other";

export interface FinancialTransaction {
  id: string;
  date: string;
  type: FinancialTransactionType;
  source: string;
  amount: number;
  description: string | null;
  bandName?: string;
  currencyCode: string;
  externalCashFlow: boolean;
}

export interface BandTreasury {
  accountId: string;
  currencyCode: string;
  balance: number;
  availableBalance: number;
}

export interface BandFinance {
  id: string;
  name: string;
  balance: number;
  currencyCode: string;
  memberCount: number;
  playerShare: number;
  treasuries: BandTreasury[];
}

export interface PlayerLoan {
  id: string;
  loan_name: string;
  principal: number;
  interest_rate: number;
  remaining_balance: number;
  weekly_payment: number;
  total_paid: number;
  started_at: string;
  due_date: string;
  status: string;
  currencyCode: string;
  purpose?: string;
}

export interface PlayerInvestment {
  id: string;
  investment_name: string;
  category: string;
  invested_amount: number;
  current_value: number;
  growth_rate: number;
  purchased_at: string;
  notes: string | null;
  currencyCode: string;
}

export interface LoanOffer {
  id: string;
  name: string;
  maxAmount: number;
  interestRate: number;
  termWeeks: number;
  description: string;
  requirements: string[];
}

export interface InvestmentOption {
  id: string;
  name: string;
  category: string;
  minInvestment: number;
  expectedReturn: string;
  risk: "Low" | "Medium" | "High";
  description: string;
}

export interface MonthlyLedgerEntry {
  month: string;
  income: number;
  expenses: number;
  currencyCode: string;
}

export interface FinancialSummary {
  currencyCode: string;
  cash: number;
  personalAccounts: number;
  totalInvested: number;
  investmentValue: number;
  totalLoans: number;
  netWorth: number;
  totalEarnings: number;
  totalExpenses: number;
  monthlyIncome: number;
  monthlyExpenses: number;
}

const LOAN_OFFERS: LoanOffer[] = [];
const INVESTMENT_OPTIONS: InvestmentOption[] = [];

const emptySummary = (currencyCode = "GBP"): FinancialSummary => ({
  currencyCode,
  cash: 0,
  personalAccounts: 0,
  totalInvested: 0,
  investmentValue: 0,
  totalLoans: 0,
  netWorth: 0,
  totalEarnings: 0,
  totalExpenses: 0,
  monthlyIncome: 0,
  monthlyExpenses: 0,
});

const mapBand = (band: FinanceCommandBand, primaryCurrency: string): BandFinance => {
  const treasuries = band.treasuries.map((treasury) => ({
    accountId: treasury.accountId,
    currencyCode: treasury.currencyCode,
    balance: fromMinorUnits(treasury.balanceMinor),
    availableBalance: fromMinorUnits(treasury.availableBalanceMinor),
  }));
  const primaryTreasury =
    treasuries.find((treasury) => treasury.currencyCode === primaryCurrency) ?? treasuries[0];

  return {
    id: band.id,
    name: band.name,
    balance: primaryTreasury?.balance ?? 0,
    currencyCode: primaryTreasury?.currencyCode ?? primaryCurrency,
    memberCount: band.memberCount,
    playerShare: 0,
    treasuries,
  };
};

const mapCommandCenter = (data: FinanceCommandCenter) => {
  const bands = data.bands.map((band) => mapBand(band, data.currencyCode));
  const bandNames = new Map(bands.map((band) => [band.id, band.name]));

  const transactions: FinancialTransaction[] = data.transactions.map((transaction) => ({
    id: transaction.id,
    date: transaction.createdAt,
    type: transaction.direction,
    source: transaction.category || transaction.source,
    amount: Math.abs(fromMinorUnits(transaction.amountMinor)),
    description: transaction.description,
    bandName:
      transaction.relatedEntityType === "band" && transaction.relatedEntityId
        ? bandNames.get(transaction.relatedEntityId)
        : undefined,
    currencyCode: transaction.currencyCode,
    externalCashFlow: transaction.externalCashFlow,
  }));

  const summary: FinancialSummary = {
    currencyCode: data.currencyCode,
    cash: fromMinorUnits(data.summary.cashMinor),
    personalAccounts: fromMinorUnits(data.summary.personalAccountsMinor),
    totalInvested: fromMinorUnits(data.summary.totalInvestedMinor),
    investmentValue: fromMinorUnits(data.summary.investmentValueMinor),
    totalLoans: fromMinorUnits(data.summary.totalLoansMinor),
    netWorth: fromMinorUnits(data.summary.netWorthMinor),
    totalEarnings: fromMinorUnits(data.summary.totalEarningsMinor),
    totalExpenses: fromMinorUnits(data.summary.totalExpensesMinor),
    monthlyIncome: fromMinorUnits(data.summary.monthlyIncomeMinor),
    monthlyExpenses: fromMinorUnits(data.summary.monthlyExpensesMinor),
  };

  const investments: PlayerInvestment[] = data.investments.map((investment) => ({
    id: investment.id,
    investment_name: investment.name,
    category: investment.category,
    invested_amount: fromMinorUnits(investment.investedMinor),
    current_value: fromMinorUnits(investment.currentValueMinor),
    growth_rate: investment.growthRate,
    purchased_at: investment.purchasedAt,
    notes: investment.notes,
    currencyCode: investment.currencyCode,
  }));

  const loans: PlayerLoan[] = data.loans.map((loan) => ({
    id: loan.id,
    loan_name: `${loan.providerName} · ${loan.purpose.replaceAll("_", " ")}`,
    principal: fromMinorUnits(loan.principalMinor),
    interest_rate: loan.interestRateBps / 100,
    remaining_balance: fromMinorUnits(loan.outstandingMinor),
    weekly_payment: fromMinorUnits(loan.scheduledPaymentMinor),
    total_paid: Math.max(0, fromMinorUnits(loan.principalMinor - loan.outstandingMinor)),
    started_at: loan.nextPaymentDate ?? loan.maturityDate,
    due_date: loan.maturityDate,
    status: loan.status,
    currencyCode: loan.currencyCode,
    purpose: loan.purpose,
  }));

  const monthlyLedger: MonthlyLedgerEntry[] = data.monthlyLedger.map((entry) => ({
    month: entry.month,
    income: fromMinorUnits(entry.incomeMinor),
    expenses: fromMinorUnits(entry.expensesMinor),
    currencyCode: entry.currencyCode,
  }));

  const earningsBySource = Object.fromEntries(
    Object.entries(data.earningsBySource).map(([source, amountMinor]) => [
      source,
      fromMinorUnits(amountMinor),
    ]),
  );

  return {
    bands,
    transactions,
    investments,
    loans,
    monthlyLedger,
    summary,
    earningsBySource,
  };
};

export const useFinances = () => {
  const {
    profileId,
    isLoading: isProfileLoading,
    error: profileError,
  } = useActiveProfile();
  const query = useQuery({
    queryKey: ["finance-command-center", profileId],
    queryFn: () => fetchFinanceCommandCenter(250),
    enabled: !!profileId,
  });

  const mapped = query.data ? mapCommandCenter(query.data) : null;
  const summary = mapped?.summary ?? emptySummary();

  return {
    profile: query.data ? { cash: summary.cash } : null,
    bands: mapped?.bands ?? [],
    transactions: mapped?.transactions ?? [],
    investments: mapped?.investments ?? [],
    loans: mapped?.loans ?? [],
    monthlyLedger: mapped?.monthlyLedger ?? [],
    summary,
    earningsBySource: mapped?.earningsBySource ?? {},
    loanOffers: LOAN_OFFERS,
    investmentOptions: INVESTMENT_OPTIONS,
    banking: query.data?.banking ?? null,
    otherCurrencyBalances: query.data?.otherCurrencyBalances ?? [],
    isLoading: isProfileLoading || (!!profileId && query.isLoading),
    error: profileError ?? query.error,
    refetch: query.refetch,
  };
};
