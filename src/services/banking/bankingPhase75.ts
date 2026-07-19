export type SavingsProductKind = "current" | "easy_access_savings" | "premium_savings" | "fixed_term_deposit" | "business_savings" | "band_reserve";
export type OwnerType = "player" | "band" | "company";

export type SavingsProduct = {
  id: string;
  kind: SavingsProductKind;
  name: string;
  currencyCode: string;
  annualRateBps: number;
  minimumBalanceMinor: number;
  maximumBalanceMinor?: number;
  withdrawalsAllowed: boolean;
  earlyWithdrawalPenaltyBps?: number;
  eligibleOwnerTypes: OwnerType[];
  openingFeeMinor?: number;
  promotionalRateBps?: number;
  promotionalUntil?: string;
  futureRates?: Array<{ effectiveDate: string; annualRateBps: number }>;
};

export type JournalLine = { accountRole: "customer_deposit" | "customer_cash" | "provider_interest_expense" | "customer_interest_income" | "provider_penalty_income" | "customer_fee_expense" | "provider_equity"; direction: "debit" | "credit"; amountMinor: number; currencyCode: string };
export type BalancedJournal = { idempotencyKey: string; category: string; description: string; lines: JournalLine[]; taxClassification?: string };
export type FixedDeposit = { id: string; principalMinor: number; currencyCode: string; openedOn: string; maturesOn: string; annualRateBps: number; autoRenew: boolean; accruedInterestMinor: number; penaltyBps: number; status: "active" | "matured" | "withdrawn" | "renewed" };
export type BankingAccountSnapshot = { id: string; productKind: SavingsProductKind; balanceMinor: number; currencyCode: string; minimumBalanceMinor?: number; lockedUntil?: string; annualRateBps?: number; interestEarnedYtdMinor?: number };
export type CashFlowTransaction = { amountMinor: number; category: string; occurredOn: string; currencyCode: string };

export function resolveSavingsRate(product: SavingsProduct, onDate: string): number {
  if (product.promotionalRateBps !== undefined && product.promotionalUntil && onDate <= product.promotionalUntil) return product.promotionalRateBps;
  return [...(product.futureRates ?? [])].filter((r) => r.effectiveDate <= onDate).sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0]?.annualRateBps ?? product.annualRateBps;
}

export function calculateDailyInterest(balanceMinor: number, annualRateBps: number): number {
  if (balanceMinor <= 0 || annualRateBps <= 0) return 0;
  return Math.floor((balanceMinor * annualRateBps) / 10000 / 365);
}

export function createInterestPostingJournal(input: { accountId: string; providerId: string; amountMinor: number; currencyCode: string; period: string }): BalancedJournal {
  return { idempotencyKey: `interest:${input.accountId}:${input.period}`, category: "savings_interest", description: `Monthly savings interest for ${input.period}`, taxClassification: "taxable_interest_income", lines: [
    { accountRole: "provider_interest_expense", direction: "debit", amountMinor: input.amountMinor, currencyCode: input.currencyCode },
    { accountRole: "customer_deposit", direction: "credit", amountMinor: input.amountMinor, currencyCode: input.currencyCode },
  ] };
}

export function isJournalBalanced(journal: BalancedJournal): boolean {
  const totals = journal.lines.reduce((acc, l) => ({ ...acc, [l.direction]: (acc[l.direction] ?? 0) + l.amountMinor }), {} as Record<string, number>);
  return (totals.debit ?? 0) === (totals.credit ?? 0);
}

export function calculateEarlyWithdrawal(fd: FixedDeposit, withdrawalDate: string) {
  const matured = withdrawalDate >= fd.maturesOn;
  const penaltyMinor = matured ? 0 : Math.min(fd.accruedInterestMinor, Math.floor((fd.principalMinor * fd.penaltyBps) / 10000));
  const interestPaidMinor = Math.max(0, fd.accruedInterestMinor - penaltyMinor);
  const payoutMinor = fd.principalMinor + interestPaidMinor;
  const journal: BalancedJournal = { idempotencyKey: `fixed-deposit-withdrawal:${fd.id}:${withdrawalDate}`, category: matured ? "fixed_deposit_maturity" : "fixed_deposit_early_withdrawal", description: matured ? "Fixed deposit maturity payout" : "Fixed deposit early withdrawal with penalty", taxClassification: "taxable_interest_income", lines: [
    { accountRole: "customer_deposit", direction: "debit", amountMinor: payoutMinor, currencyCode: fd.currencyCode },
    { accountRole: "customer_cash", direction: "credit", amountMinor: payoutMinor, currencyCode: fd.currencyCode },
    ...(penaltyMinor ? [{ accountRole: "customer_fee_expense" as const, direction: "debit" as const, amountMinor: penaltyMinor, currencyCode: fd.currencyCode }, { accountRole: "provider_penalty_income" as const, direction: "credit" as const, amountMinor: penaltyMinor, currencyCode: fd.currencyCode }] : []),
  ] };
  return { matured, penaltyMinor, interestPaidMinor, payoutMinor, journal };
}

export function calculateLiquidity(input: { customerDepositsMinor: number; lockedDepositsMinor: number; outstandingLoansMinor: number; reserveRequirementBps: number }) {
  const requiredReservesMinor = Math.ceil((input.customerDepositsMinor * input.reserveRequirementBps) / 10000);
  const availableReservesMinor = Math.max(0, input.customerDepositsMinor - input.outstandingLoansMinor);
  const excessReservesMinor = availableReservesMinor - requiredReservesMinor;
  return { requiredReservesMinor, availableReservesMinor, availableLendingCapitalMinor: Math.max(0, excessReservesMinor), reserveRatioBps: input.customerDepositsMinor ? Math.floor((availableReservesMinor * 10000) / input.customerDepositsMinor) : 10000, liquidityWarning: excessReservesMinor < 0 };
}

export function calculateDepositProtection(balanceMinor: number, protectionLimitMinor: number) { return { protectedMinor: Math.min(balanceMinor, protectionLimitMinor), unprotectedMinor: Math.max(0, balanceMinor - protectionLimitMinor) }; }

export function buildMonthlyStatement(input: { openingBalanceMinor: number; transactions: CashFlowTransaction[]; interestMinor: number; feesMinor: number; currencyCode: string }) {
  const depositsMinor = input.transactions.filter((t) => t.amountMinor > 0).reduce((s, t) => s + t.amountMinor, 0);
  const withdrawalsMinor = Math.abs(input.transactions.filter((t) => t.amountMinor < 0).reduce((s, t) => s + t.amountMinor, 0));
  return { openingBalanceMinor: input.openingBalanceMinor, depositsMinor, withdrawalsMinor, interestMinor: input.interestMinor, feesMinor: input.feesMinor, closingBalanceMinor: input.openingBalanceMinor + depositsMinor - withdrawalsMinor + input.interestMinor - input.feesMinor, currencyCode: input.currencyCode };
}

export function calculateCashFlowAnalytics(transactions: CashFlowTransaction[]) {
  const income = transactions.filter((t) => t.amountMinor > 0).reduce((s, t) => s + t.amountMinor, 0);
  const expenses = Math.abs(transactions.filter((t) => t.amountMinor < 0).reduce((s, t) => s + t.amountMinor, 0));
  const byCategory = transactions.filter((t) => t.amountMinor < 0).reduce((m, t) => m.set(t.category, (m.get(t.category) ?? 0) + Math.abs(t.amountMinor)), new Map<string, number>());
  return { incomeMinor: income, expensesMinor: expenses, savingsRateBps: income ? Math.floor(((income - expenses) * 10000) / income) : 0, largestExpenseCategories: [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3), financialHealth: income > expenses ? "positive" : income === expenses ? "balanced" : "strained" };
}
