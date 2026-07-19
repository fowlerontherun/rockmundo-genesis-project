import { describe, expect, it } from "vitest";
import { buildMonthlyStatement, calculateCashFlowAnalytics, calculateDailyInterest, calculateDepositProtection, calculateEarlyWithdrawal, calculateLiquidity, createInterestPostingJournal, isJournalBalanced, resolveSavingsRate, type FixedDeposit, type SavingsProduct } from "./bankingPhase75";

describe("Finance Phase 7.5 savings and personal banking", () => {
  const product: SavingsProduct = { id: "easy", kind: "easy_access_savings", name: "Easy Access Savings", currencyCode: "USD", annualRateBps: 250, minimumBalanceMinor: 10000, withdrawalsAllowed: true, eligibleOwnerTypes: ["player"], promotionalRateBps: 500, promotionalUntil: "2026-08-31", futureRates: [{ effectiveDate: "2026-09-01", annualRateBps: 325 }] };

  it("supports promotional, variable and future provider rates", () => {
    expect(resolveSavingsRate(product, "2026-07-19")).toBe(500);
    expect(resolveSavingsRate(product, "2026-09-02")).toBe(325);
    expect(calculateDailyInterest(3650000, 365)).toBe(365);
  });

  it("posts monthly interest through a balanced provider/customer journal", () => {
    const journal = createInterestPostingJournal({ accountId: "acct-1", providerId: "bank-1", amountMinor: 1234, currencyCode: "GBP", period: "2026-07" });
    expect(journal.taxClassification).toBe("taxable_interest_income");
    expect(journal.lines).toEqual(expect.arrayContaining([expect.objectContaining({ accountRole: "provider_interest_expense", direction: "debit" }), expect.objectContaining({ accountRole: "customer_deposit", direction: "credit" })]));
    expect(isJournalBalanced(journal)).toBe(true);
  });

  it("calculates fixed deposit maturity and early withdrawal penalties", () => {
    const deposit: FixedDeposit = { id: "fd-1", principalMinor: 100000, currencyCode: "EUR", openedOn: "2026-01-01", maturesOn: "2027-01-01", annualRateBps: 600, autoRenew: true, accruedInterestMinor: 4000, penaltyBps: 250, status: "active" };
    const early = calculateEarlyWithdrawal(deposit, "2026-07-19");
    expect(early.penaltyMinor).toBe(2500);
    expect(early.payoutMinor).toBe(101500);
    expect(isJournalBalanced(early.journal)).toBe(true);
    const matured = calculateEarlyWithdrawal(deposit, "2027-01-01");
    expect(matured.penaltyMinor).toBe(0);
    expect(matured.payoutMinor).toBe(104000);
  });

  it("tracks reserve liquidity and deposit protection", () => {
    expect(calculateLiquidity({ customerDepositsMinor: 1000000, lockedDepositsMinor: 200000, outstandingLoansMinor: 850000, reserveRequirementBps: 2000 })).toMatchObject({ liquidityWarning: true, availableLendingCapitalMinor: 0 });
    expect(calculateDepositProtection(300000, 250000)).toEqual({ protectedMinor: 250000, unprotectedMinor: 50000 });
  });

  it("builds monthly statements and cash-flow analytics for goals and dashboards", () => {
    const tx = [{ amountMinor: 200000, category: "income", occurredOn: "2026-07-01", currencyCode: "USD" }, { amountMinor: -50000, category: "rent", occurredOn: "2026-07-02", currencyCode: "USD" }, { amountMinor: -25000, category: "gear", occurredOn: "2026-07-03", currencyCode: "USD" }];
    expect(buildMonthlyStatement({ openingBalanceMinor: 100000, transactions: tx, interestMinor: 500, feesMinor: 100, currencyCode: "USD" }).closingBalanceMinor).toBe(225400);
    expect(calculateCashFlowAnalytics(tx)).toMatchObject({ incomeMinor: 200000, expensesMinor: 75000, savingsRateBps: 6250, financialHealth: "positive" });
  });
});
