import { supabase } from "@/integrations/supabase/client";

export type FinanceDirection = "income" | "expense" | "transfer" | "other";

export type FinanceCommandSummary = {
  cashMinor: number;
  personalAccountsMinor: number;
  totalInvestedMinor: number;
  investmentValueMinor: number;
  totalLoansMinor: number;
  netWorthMinor: number;
  totalEarningsMinor: number;
  totalExpensesMinor: number;
  monthlyIncomeMinor: number;
  monthlyExpensesMinor: number;
};

export type FinanceCommandTransaction = {
  id: string;
  createdAt: string;
  direction: FinanceDirection;
  source: string;
  amountMinor: number;
  description: string | null;
  currencyCode: string;
  category: string;
  sourceAccountId: string | null;
  destinationAccountId: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  externalCashFlow: boolean;
};

export type FinanceCommandMonth = {
  monthKey: string;
  month: string;
  incomeMinor: number;
  expensesMinor: number;
  currencyCode: string;
};

export type FinanceCommandInvestment = {
  id: string;
  name: string;
  category: string;
  investedMinor: number;
  currentValueMinor: number;
  growthRate: number;
  purchasedAt: string;
  notes: string | null;
  currencyCode: string;
};

export type FinanceCommandLoan = {
  id: string;
  providerName: string;
  status: string;
  principalMinor: number;
  outstandingMinor: number;
  currencyCode: string;
  interestRateBps: number;
  scheduledPaymentMinor: number;
  nextPaymentDate: string | null;
  maturityDate: string;
  purpose: string;
};

export type FinanceTreasuryBalance = {
  accountId: string;
  currencyCode: string;
  balanceMinor: number;
  availableBalanceMinor: number;
};

export type FinanceCommandBand = {
  id: string;
  name: string;
  memberCount: number;
  treasuries: FinanceTreasuryBalance[];
};

export type OtherCurrencyBalance = {
  currencyCode: string;
  balanceMinor: number;
  availableBalanceMinor: number;
};

export type FinanceCommandCenter = {
  status: "ok";
  profileId: string;
  currencyCode: string;
  banking: Record<string, unknown>;
  summary: FinanceCommandSummary;
  transactions: FinanceCommandTransaction[];
  monthlyLedger: FinanceCommandMonth[];
  earningsBySource: Record<string, number>;
  investments: FinanceCommandInvestment[];
  loans: FinanceCommandLoan[];
  bands: FinanceCommandBand[];
  otherCurrencyBalances: OtherCurrencyBalance[];
};

export const fetchFinanceCommandCenter = async (
  transactionLimit = 100,
): Promise<FinanceCommandCenter> => {
  const safeLimit = Math.min(Math.max(Math.trunc(transactionLimit), 1), 250);
  const { data, error } = await (supabase.rpc as any)(
    "get_my_finance_command_center",
    { p_transaction_limit: safeLimit },
  );

  if (error) {
    throw new Error(error.message || "The finance dashboard could not be loaded.");
  }
  if (!data) throw new Error("finance_command_center_empty_response");

  return data as FinanceCommandCenter;
};
