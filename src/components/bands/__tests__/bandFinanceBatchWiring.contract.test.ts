import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (file: string) => readFileSync(
  fileURLToPath(new URL(file, import.meta.url)), "utf8",
);
const finances = read("../BandFinancesTab.tsx");
const funding = read("../AddMoneyToBand.tsx");
const source = read("../../../hooks/useBandPaymentSource.ts");
const booking = read("../../../hooks/useRehearsalBooking.ts");
const rehearsalPage = read("../../../pages/Rehearsals.tsx");
const rehearsalTab = read("../../performance/RehearsalsTab.tsx");
const rehearsalDialog = read("../../performance/RehearsalBookingDialog.tsx");

describe("band finance five issue fixes", () => {
  it("#4018 uses member status and excludes touring members", () => {
    expect(finances).toContain('"id, member_status, is_touring_member, user_id"');
    expect(finances).toContain("countActiveRegularBandMembers(membersData ?? [])");
  });

  it("#4019 transparently labels all last-50 earnings and source summaries", () => {
    expect(finances).toContain(".limit(RECENT_FINANCE_ENTRY_LIMIT)");
    expect(finances).toContain("Last 50 · Income");
    expect(finances).toContain("Last 50 · Expenses");
    expect(finances).toContain("latest 50 entries only");
  });

  it("#4020 calculates monthly spending from every expense in the last 30 days, paginated", () => {
    expect(finances).toContain('new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)');
    expect(finances).toContain('.lt("amount", 0)');
    expect(finances).toContain('.gte("created_at", from)');
    expect(finances).toContain('.range(offset, offset + 499)');
    expect(finances).toContain("monthlyBandRunway(balance, last30DayExpenses)");
    expect(finances).toContain('aggregated.monthlyRunway === null ? "N/A"');
    expect(finances).not.toContain("balance / averageExpense");
  });

  it("#4016 resets preview on note edits and recomputes balances before funding", () => {
    expect(funding).toContain("setNote(event.target.value);\n                    resetPreview();");
    expect(funding).toContain('if (!latest || !fundingPreviewStillCurrent(');
    expect(funding).toContain('"preview_my_band_funding"');
    expect(funding).toContain("Your funding preview has expired or balances changed");
    expect(funding).toContain("setConfirmationKey(crypto.randomUUID())");
  });

  it("#4028 passes the selected rehearsal payer explicitly without a global map", () => {
    expect(source).not.toContain("pendingAtomicRehearsalSources");
    expect(source).not.toContain("consumeAtomicRehearsalPaymentSource");
    expect(booking).toContain("paymentSource?: BandPaymentSource");
    expect(booking).toContain('const paymentSource = params.paymentSource ?? "band"');
    expect(rehearsalPage).toContain("        paymentSource,\n        bandId:");
    expect(rehearsalTab).toContain("        paymentSource: _paymentSource,");
    expect(rehearsalDialog).not.toContain("await payment.prepareFunds");
  });
});
