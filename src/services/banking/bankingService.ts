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
  const { data, error } = await supabase.rpc("get_banking_dashboard");

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
  const { data, error } = await supabase.rpc("create_loan_application", {
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
  const { data, error } = await supabase.rpc("accept_loan_offer", {
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
