import { describe, expect, it } from "vitest";
import { generateCityProperties, isPropertyJournalBalanced, type PropertyTemplate } from "./propertyPhase8A";
import { assessAffordability, buildMortgageDashboard, calculateLtvBps, canTransferProperty, createPurchaseCompletion, generateSettlementQuote, makeOverpayment, processMortgagePayment, progressArrears, refinanceMortgage, resolveMortgageRate, type BorrowerFinancials, type MortgageAdminPolicy, type MortgageProduct } from "./mortgagePhase8B";

const propertyTemplate: PropertyTemplate = { id: "flat", city: "London", district: "Camden", category: "residential", type: "Flat", quality: 4, sizeSqm: 50, rooms: 3, bedrooms: 1, capacity: 2, monthlyCosts: { maintenance: { amountMinor: 12000, currencyCode: "GBP" } }, purchaseValue: { amountMinor: 30000000, currencyCode: "GBP" }, rentalValue: { amountMinor: 120000, currencyCode: "GBP" }, maintenanceLevel: 2, prestige: 5, upgradePotential: 6, storageCapacity: 140 };
const policy: MortgageAdminPolicy = { baseRates: [{ currencyCode: "GBP", effectiveDate: "2026-01-01", annualRateBps: 425 }], affordabilityStressRateBps: 700, maxDebtToIncomeBps: 4500, recoveryGraceDays: 14, products: [] };
const product: MortgageProduct = { id: "standard", name: "Standard repayment", kind: "standard_repayment", eligibleBorrowerTypes: ["player", "band", "company"], maxLtvBps: 8000, minimumDepositBps: 2000, minTermMonths: 60, maxTermMonths: 360, interestModel: "fixed", repaymentStrategy: "repayment", annualRateBps: 500, earlyRepaymentChargeBps: 100, fees: [{ name: "Arrangement", amount: { amountMinor: 99900, currencyCode: "GBP" } }], currencyCode: "GBP", eligiblePropertyCategories: ["residential", "commercial"], allowOverpaymentReducePayment: true };
const financials: BorrowerFinancials = { borrowerType: "player", borrowerId: "player-1", salaryMinor: 850000, royaltiesMinor: 120000, gigIncomeMinor: 80000, existingCommitmentsMinor: 75000, savingsMinor: 7000000, creditScore: 720, currencyCode: "GBP" };

function complete() { const [property] = generateCityProperties([propertyTemplate], { flat: 1 }); return createPurchaseCompletion({ property, buyer: { type: "player", id: "player-1" }, sellerId: "world", product, policy, financials, lenderId: "bank-1", termMonths: 300, completionDate: "2026-08-01", firstPaymentDate: "2026-09-01", repaymentMethod: "direct_debit" }); }

describe("Finance Phase 8B mortgages, collateral and secured lending", () => {
  it("approves mortgage applications from authoritative affordability data", () => {
    const [property] = generateCityProperties([propertyTemplate], { flat: 1 });
    const result = assessAffordability(financials, product, property, 300, policy);
    expect(result).toMatchObject({ eligible: true, requiredDepositMinor: 6000000, maxLoanMinor: 24000000 });
    expect(result.disposableIncomeMinor).toBeGreaterThan(0);
  });

  it("completes property purchase atomically with deposit, mortgage funding, ownership transfer and charge registration", () => {
    const purchase = complete();
    expect(purchase.transactionSteps).toEqual(["reserve_property", "validate_funding", "lock_transaction", "collect_deposit", "create_mortgage_contract", "transfer_mortgage_funds", "transfer_ownership", "register_lender_charge", "schedule_repayments", "notify_systems"]);
    expect(purchase.property.ownerId).toBe("player-1");
    expect(purchase.property.futureFinance?.mortgageId).toBe(purchase.mortgage.id);
    expect(purchase.mortgage).toMatchObject({ securedPropertyId: purchase.property.id, collateralStatus: "registered", status: "active" });
    expect(purchase.journals.every(isPropertyJournalBalanced)).toBe(true);
  });

  it("prevents invalid transfers until settlement rules release security", () => {
    const { property, mortgage } = complete();
    expect(canTransferProperty(property, [mortgage])).toMatchObject({ allowed: false, blockingMortgageId: mortgage.id, settlementRequiredMinor: mortgage.outstandingBalance.amountMinor });
    const paid = processMortgagePayment(mortgage, "2026-09-01", mortgage.outstandingBalance.amountMinor + 1_000_000).mortgage;
    expect(canTransferProperty(property, [paid])).toMatchObject({ allowed: true });
  });

  it("processes repayments and reconciles principal and interest through balanced ledger lines", () => {
    const { mortgage } = complete();
    const payment = processMortgagePayment(mortgage, "2026-09-01");
    expect(payment.mortgage.outstandingBalance.amountMinor).toBeLessThan(mortgage.outstandingBalance.amountMinor);
    expect(payment.mortgage.interestPaidMinor).toBeGreaterThan(0);
    expect(isPropertyJournalBalanced(payment.journal)).toBe(true);
  });

  it("supports one-off overpayments, settlement quotes and dashboard metrics", () => {
    const { mortgage, property } = complete();
    const overpaid = makeOverpayment(mortgage, "2026-10-01", { amountMinor: 1000000, currencyCode: "GBP" }, "reduce_term");
    const quote = generateSettlementQuote(overpaid, product, "2026-10-02", "2026-10-16");
    const dashboard = buildMortgageDashboard(overpaid, property);
    expect(overpaid.overpaymentHistory).toHaveLength(1);
    expect(quote.totalPayable.amountMinor).toBeGreaterThan(overpaid.outstandingBalance.amountMinor);
    expect(dashboard.ownerEquity.amountMinor).toBeGreaterThan(0);
    expect(dashboard.currentLtvBps).toBe(calculateLtvBps(overpaid.outstandingBalance, property.estimatedMarketValue));
  });

  it("supports variable rates, refinancing, arrears recovery and multi-currency isolation", () => {
    const { mortgage, property } = complete();
    const variable: MortgageProduct = { ...product, id: "tracker", interestModel: "variable", marginRateBps: 125, annualRateBps: 0, revisionHistory: [{ effectiveDate: "2026-09-01", annualRateBps: 0, marginRateBps: 150 }] };
    expect(resolveMortgageRate(variable, policy, "2026-09-10")).toBe(575);
    const refinanced = refinanceMortgage(mortgage, variable, policy, property, financials, "2026-09-10");
    expect(refinanced.productId).toBe("tracker");
    expect(refinanced.rateHistory.at(-1)).toMatchObject({ reason: "refinance" });
    const arrears = progressArrears(refinanced, "2026-10-01", 35);
    expect(arrears).toMatchObject({ status: "arrears", collateralStatus: "in_arrears", arrears: expect.objectContaining({ missedPayments: 1, recoveryPlan: "contact_borrower_and_offer_payment_arrangement" }) });

    const usdTemplate = { ...propertyTemplate, id: "loft", city: "New York", purchaseValue: { amountMinor: 50000000, currencyCode: "USD" }, rentalValue: { amountMinor: 200000, currencyCode: "USD" }, monthlyCosts: { maintenance: { amountMinor: 15000, currencyCode: "USD" } } };
    const [usdProperty] = generateCityProperties([usdTemplate], { loft: 1 });
    const usdProduct = { ...product, id: "usd-commercial", currencyCode: "USD", eligibleBorrowerTypes: ["company"] as const };
    const usdFinancials: BorrowerFinancials = { borrowerType: "company", borrowerId: "company-1", operatingProfitMinor: 1_500_000, cashFlowMinor: 500_000, payrollMinor: 300_000, existingCommitmentsMinor: 100_000, savingsMinor: 12_000_000, creditScore: 760, currencyCode: "USD" };
    const usdPurchase = createPurchaseCompletion({ property: usdProperty, buyer: { type: "company", id: "company-1" }, sellerId: "world", product: usdProduct, policy, financials: usdFinancials, lenderId: "bank-us", termMonths: 240, completionDate: "2026-11-01", firstPaymentDate: "2026-12-01", repaymentMethod: "manual" });
    expect(usdPurchase.journals.flatMap((j) => j.lines).every((l) => l.currencyCode === "USD")).toBe(true);
  });
});
