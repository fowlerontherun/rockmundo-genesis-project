import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatMoney, fromMinorUnits } from "@/lib/financeFormatting";

const read = (file: string) => fs.readFileSync(path.resolve(file), "utf8");

const hookSource = read("src/hooks/useFinances.ts");
const pageSource = read("src/pages/Finances.tsx");
const holdingsSource = read("src/components/finance/CanonicalFinanceHoldings.tsx");
const charitySource = read("src/components/finance/CharityDonationsTab.tsx");
const charityApiSource = read("src/lib/api/charityDonations.ts");
const transactionSource = read("src/components/finance/TransactionsList.tsx");
const summarySource = read("src/components/finance/FinanceSummaryCards.tsx");
const personalSource = read("src/components/finance/PersonalFinanceBreakdown.tsx");
const bandSource = read("src/components/finance/BandFinanceDetail.tsx");
const formattingSource = read("src/lib/financeFormatting.ts");

const migratedUiSources = [
  pageSource,
  holdingsSource,
  charitySource,
  transactionSource,
  summarySource,
  personalSource,
  bandSource,
  read("src/components/finance/IncomeExpenseChart.tsx"),
  read("src/components/finance/IncomeBreakdownChart.tsx"),
  read("src/components/finance/SpendingCategoriesChart.tsx"),
  read("src/components/finance/PlayerFinanceHub.tsx"),
  read("src/components/finance/FinancialHistoryLedger.tsx"),
].join("\n");

describe("canonical Financial Command Center UI", () => {
  it("loads the active-character command center instead of compatibility tables", () => {
    expect(hookSource).toContain("fetchFinanceCommandCenter(250)");
    expect(hookSource).toContain('["finance-command-center", profileId]');
    expect(hookSource).not.toContain('.from("profiles")');
    expect(hookSource).not.toContain("band_earnings");
    expect(hookSource).not.toContain("band_balance");
  });

  it("does not hide active-profile loading failures behind an empty dashboard", () => {
    expect(hookSource).toContain("isProfileLoading");
    expect(hookSource).toContain("profileError ?? query.error");
  });

  it("refreshes live balances and outgoings instead of serving a stale snapshot", () => {
    expect(hookSource).toContain("staleTime: 0");
    expect(hookSource).toContain('refetchOnMount: "always"');
    expect(hookSource).toContain("refetchOnWindowFocus: true");
    expect(hookSource).toContain("refetchInterval: 15_000");
    expect(hookSource).toContain("refetchIntervalInBackground: false");
  });

  it("keeps transfers visible without classifying them as spending", () => {
    expect(hookSource).toContain('"transfer"');
    expect(hookSource).toContain("externalCashFlow");
    expect(transactionSource).toContain('value: "transfer"');
    expect(transactionSource).toContain("item.externalCashFlow");
  });

  it("keeps band treasuries separate from personal net worth", () => {
    expect(summarySource).toContain("Band treasuries excluded");
    expect(personalSource).toContain("Band treasuries and foreign currencies are excluded");
    expect(bandSource).toContain("fictional personal share");
    expect(bandSource).not.toContain("playerShare");
  });

  it("uses en-GB formatting and the active currency rather than USD", () => {
    expect(formattingSource).toContain('new Intl.NumberFormat("en-GB"');
    expect(formattingSource).toContain('currencyCode = "GBP"');
    expect(migratedUiSources).not.toContain('currency: "USD"');
    expect(formatMoney(1234, "GBP")).toContain("£");
    expect(fromMinorUnits(12345)).toBe(123.45);
  });

  it("keeps unsafe legacy mutations out of reachable finance tabs", () => {
    expect(pageSource).not.toContain("InvestmentsTab");
    expect(pageSource).not.toContain("LoansTab");
    expect(pageSource).toContain("CharityDonationsTab");
    expect(pageSource).toContain("CanonicalInvestmentsPanel");
    expect(pageSource).toContain("CanonicalLoansPanel");
    expect(holdingsSource).not.toContain("supabase");
    expect(holdingsSource).toContain("temporarily read-only");
    expect(charitySource).not.toContain('.from("profiles")');
    expect(charitySource).not.toContain('.from("charity_donations").insert');
    expect(charityApiSource).toContain('"make_my_charity_donation"');
  });

  it("discloses other currencies without fake conversion", () => {
    expect(pageSource).toContain("OtherCurrencyBalancesPanel");
    expect(holdingsSource).toContain("no exchange rate is being assumed");
    expect(holdingsSource).toContain("formatMinorMoney");
  });
});
