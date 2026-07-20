import { supabase } from "@/integrations/supabase/client";
import { formatCurrencyMinor } from "./currency";

export type CurrencyMinor = {
  amountMinor: number;
  currencyCode: string;
};

export type BankingDashboard = {
  accounts: Array<{
    id: string;
    accountType: string;
    currencyCode: string;
    balanceMinor: number;
    providerName: string;
    restrictionSummary?: string;
    annualRateBps?: number;
  }>;
  loans: Array<{
    id: string;
    providerName: string;
    status: string;
    principalMinor: number;
    outstandingPrincipalMinor: number;
    currencyCode: string;
    interestRateBps: number;
    nextPaymentMinor: number;
    nextPaymentDate?: string;
    overdueMinor: number;
  }>;
  creditProfile?: {
    band: string;
    score?: number;
    positiveFactors: string[];
    negativeFactors: string[];
  };
  recentActivity: Array<{
    id: string;
    description: string;
    amountMinor: number;
    currencyCode: string;
    createdAt: string;
  }>;
  savingsSummary?: {
    netWorthMinor: number; cashMinor: number; savingsMinor: number; lockedDepositsMinor: number; monthlyInterestMinor: number; interestEarnedYtdMinor: number; currencyCode: string; nextMaturityDate?: string;
  };
  cashFlowAnalytics?: { incomeMinor: number; expensesMinor: number; savingsRateBps: number; financialHealth: string; largestExpenseCategories: Array<[string, number]> };
  savingsGoals?: Array<{ id: string; name: string; targetMinor: number; currentMinor: number; currencyCode: string; completionBps: number; projectedCompletionDate?: string }>;
  notifications?: Array<{ id: string; type: string; title: string; body: string; severity: "info" | "warning" | "success"; createdAt: string }>;
};

export type LoanOfferSummary = {
  principalMinor: number;
  originationFeeMinor: number;
  netProceedsMinor: number;
  totalInterestMinor: number;
  totalRepaymentMinor: number;
  firstPaymentMinor: number;
  middlePaymentMinor: number;
  finalPaymentMinor: number;
  currencyCode: string;
  scheduleDescription: string;
};

const fallbackDashboard: BankingDashboard = {
  accounts: [],
  loans: [],
  creditProfile: {
    band: "Building",
    positiveFactors: ["Open a current account to start building a banking history."],
    negativeFactors: [],
  },
  recentActivity: [],
};

export { formatCurrencyMinor };

export function summarizeEqualPrincipalOffer(input: {
  principalMinor: number;
  originationFeeMinor: number;
  currencyCode: string;
  scheduleLines: Array<{ totalDueMinor: number }>;
  totalInterestMinor: number;
}): LoanOfferSummary {
  const middleIndex = Math.max(0, Math.floor((input.scheduleLines.length - 1) / 2));
  return {
    principalMinor: input.principalMinor,
    originationFeeMinor: input.originationFeeMinor,
    netProceedsMinor: input.principalMinor,
    totalInterestMinor: input.totalInterestMinor,
    totalRepaymentMinor: input.principalMinor + input.originationFeeMinor + input.totalInterestMinor,
    firstPaymentMinor: input.scheduleLines[0]?.totalDueMinor ?? 0,
    middlePaymentMinor: input.scheduleLines[middleIndex]?.totalDueMinor ?? 0,
    finalPaymentMinor: input.scheduleLines[input.scheduleLines.length - 1]?.totalDueMinor ?? 0,
    currencyCode: input.currencyCode,
    scheduleDescription: "Equal-principal schedule: payments decline as principal decreases.",
  };
}

export async function fetchBankingDashboard(): Promise<BankingDashboard> {
  const { data, error } = await (supabase as any).rpc("get_banking_dashboard");

  if (error) {
    throw new Error(mapBankingError(error));
  }

  return (data as BankingDashboard | null) ?? fallbackDashboard;
}

export async function createLoanApplication(input: {
  borrowerType: "player" | "band" | "company";
  borrowerId: string;
  productId: string;
  requestedAmountMinor: number;
  requestedTermMonths: number;
  purpose: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  expectedUse: string;
  idempotencyKey: string;
}): Promise<string> {
  const { data, error } = await (supabase as any).rpc("create_loan_application", {
    p_borrower_type: input.borrowerType,
    p_borrower_id: input.borrowerId,
    p_product_id: input.productId,
    p_requested_amount_minor: input.requestedAmountMinor,
    p_requested_term_months: input.requestedTermMonths,
    p_purpose: input.purpose,
    p_related_entity_type: input.relatedEntityType ?? null,
    p_related_entity_id: input.relatedEntityId ?? null,
    p_expected_use: input.expectedUse,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) {
    throw new Error(mapBankingError(error));
  }

  return String(data);
}

export async function acceptLoanOffer(input: {
  offerId: string;
  disbursementBankAccountId: string;
  repaymentBankAccountId: string;
  idempotencyKey: string;
}): Promise<string> {
  const { data, error } = await (supabase as any).rpc("accept_loan_offer", {
    p_offer_id: input.offerId,
    p_disbursement_bank_account_id: input.disbursementBankAccountId,
    p_repayment_bank_account_id: input.repaymentBankAccountId,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) {
    throw new Error(mapBankingError(error));
  }

  return String(data);
}

export function mapBankingError(error: { code?: string; message?: string }): string {
  if (error.code === "42501") return "You do not have permission to perform this banking action.";
  if (error.message?.toLowerCase().includes("insufficient funds")) return "There is not enough money in the selected account.";
  return error.message ?? "Banking is temporarily unavailable.";
}

export type BankingProduct = {
  id: string;
  providerId: string;
  providerName: string;
  productName: string;
  allowedPurposes: string[];
  supportedCurrencies: string[];
  minimumAmountMinor: number;
  maximumAmountMinor: number;
  minimumTermMonths: number;
  maximumTermMonths: number;
  interestRateBps: number;
  originationFeeBps: number;
  originationFeeFlatMinor: number;
  scheduleType: string;
  eligibilityNotes?: unknown;
};

export type PlayerBankAccount = {
  id: string;
  providerName: string;
  accountType: string;
  currencyCode: string;
  status: string;
  balanceMinor: number;
};

export type LoanDetail = {
  id: string;
  providerName: string;
  status: string;
  purpose: string;
  principalMinor: number;
  outstandingPrincipalMinor: number;
  currencyCode: string;
  interestRateBps: number;
  originationFeeMinor: number;
  nextPaymentMinor: number;
  nextPaymentDate?: string;
  repaymentBankAccountId?: string;
};

export type LoanScheduleLine = {
  id: string;
  instalmentNumber: number;
  dueDate: string;
  openingPrincipalMinor: number;
  principalMinor: number;
  interestMinor: number;
  feeMinor: number;
  totalDueMinor: number;
  amountPaidMinor: number;
  status: string;
};

export function estimateEqualPrincipalSchedule(input: { principalMinor: number; interestRateBps: number; termMonths: number; firstPaymentDate?: Date }) {
  const monthlyPrincipal = Math.floor(input.principalMinor / input.termMonths);
  let remaining = input.principalMinor;
  return Array.from({ length: input.termMonths }, (_, index) => {
    const principal = index === input.termMonths - 1 ? remaining : monthlyPrincipal;
    const interest = Math.floor((remaining * input.interestRateBps) / 120000);
    remaining -= principal;
    return { instalmentNumber: index + 1, principalMinor: principal, interestMinor: interest, feeMinor: 0, totalDueMinor: principal + interest };
  });
}

export async function listEligibleLoanProducts(): Promise<BankingProduct[]> {
  const { data, error } = await (supabase.rpc as any)("list_eligible_loan_products", { p_borrower_type: "player" });
  if (error) throw new Error(mapBankingError(error));
  return (data as BankingProduct[] | null) ?? [];
}

export async function listPlayerBankAccounts(): Promise<PlayerBankAccount[]> {
  const { data, error } = await (supabase.rpc as any)("list_player_bank_accounts");
  if (error) throw new Error(mapBankingError(error));
  return (data as PlayerBankAccount[] | null) ?? [];
}

export async function getLoanApplicationResult(applicationId: string) {
  const { data, error } = await (supabase.rpc as any)("get_loan_application_result", { p_application_id: applicationId });
  if (error) throw new Error(mapBankingError(error));
  return data as any;
}

export async function getLoanDetails(loanContractId: string): Promise<LoanDetail | null> {
  const { data, error } = await (supabase.rpc as any)("get_loan_details", { p_loan_contract_id: loanContractId });
  if (error) throw new Error(mapBankingError(error));
  return (data as LoanDetail | null) ?? null;
}

export async function getLoanSchedule(loanContractId: string): Promise<LoanScheduleLine[]> {
  const { data, error } = await (supabase.rpc as any)("get_loan_schedule", { p_loan_contract_id: loanContractId });
  if (error) throw new Error(mapBankingError(error));
  return (data as LoanScheduleLine[] | null) ?? [];
}

export async function listLoanPaymentAttempts(loanContractId: string) {
  const { data, error } = await (supabase.rpc as any)("list_loan_payment_attempts", { p_loan_contract_id: loanContractId });
  if (error) throw new Error(mapBankingError(error));
  return (data as any[] | null) ?? [];
}

export async function retryLoanPayment(input: { loanContractId: string; scheduleLineId: string; idempotencyKey: string }) {
  const { data, error } = await (supabase.rpc as any)("retry_loan_payment", { p_loan_contract_id: input.loanContractId, p_schedule_line_id: input.scheduleLineId, p_idempotency_key: input.idempotencyKey });
  if (error) throw new Error(mapBankingError(error));
  return data as any;
}
