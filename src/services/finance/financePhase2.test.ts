import { describe, expect, it } from "vitest";
import { calculateDistributionAllocations, ELIGIBLE_DISTRIBUTION_CATEGORIES, INELIGIBLE_DISTRIBUTION_CATEGORIES, nextDueDate } from "./financePhase2";

describe("Finance Phase 2 distribution and recurring rules", () => {
  const members = [{ profileId: "p1", role: "leader" }, { profileId: "p2", role: "member" }, { profileId: "p3", role: "member", active: false }];

  it("splits eligible income equally and assigns rounding remainder", () => {
    const plan = calculateDistributionAllocations({ amountMinor: 1001, members, method: "equal" });
    expect(plan.distributableAmountMinor).toBe(1001);
    expect(plan.allocations.map((a) => a.amountMinor)).toEqual([501, 500]);
  });

  it("rejects custom percentages that do not total 100%", () => {
    expect(() => calculateDistributionAllocations({ amountMinor: 1000, members, method: "custom_percentage", customPercentages: { p1: 6000, p2: 3000 } })).toThrow(/100%/);
  });

  it("supports reserve-then-distribute policies", () => {
    const plan = calculateDistributionAllocations({ amountMinor: 10000, members, method: "reserve_then_distribute", reserveBasisPoints: 2500 });
    expect(plan.reserveRetainedMinor).toBe(2500);
    expect(plan.distributableAmountMinor).toBe(7500);
    expect(plan.allocations.reduce((sum, a) => sum + a.amountMinor, 0)).toBe(7500);
  });

  it("retains all income without member allocations", () => {
    const plan = calculateDistributionAllocations({ amountMinor: 10000, members, method: "retain_all" });
    expect(plan.reserveRetainedMinor).toBe(10000);
    expect(plan.allocations).toHaveLength(0);
  });

  it("keeps eligible and ineligible distribution categories explicit", () => {
    expect(ELIGIBLE_DISTRIBUTION_CATEGORIES.has("gig_payment")).toBe(true);
    expect(INELIGIBLE_DISTRIBUTION_CATEGORIES.has("band_contribution")).toBe(true);
  });

  it("calculates next due dates for recurring obligations", () => {
    expect(nextDueDate(new Date("2026-07-17T00:00:00Z"), "weekly")).toBe("2026-07-24");
    expect(nextDueDate(new Date("2026-07-17T00:00:00Z"), "custom_interval", 10)).toBe("2026-07-27");
  });
});
