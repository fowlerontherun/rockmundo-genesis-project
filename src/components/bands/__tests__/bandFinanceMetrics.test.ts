import { describe, expect, it } from "vitest";
import {
  countActiveRegularBandMembers,
  monthlyBandRunway,
} from "../bandFinanceMetrics";

describe("band finance metrics", () => {
  it("#4018 counts only active non-touring members", () => {
    expect(countActiveRegularBandMembers([
      { member_status: "active", is_touring_member: false },
      { member_status: "active", is_touring_member: null },
      { member_status: "active", is_touring_member: true },
      { member_status: "left", is_touring_member: false },
      { member_status: "inactive", is_touring_member: false },
      { member_status: null, is_touring_member: false },
    ])).toBe(2);
    expect(countActiveRegularBandMembers([])).toBe(0);
  });

  it("#4020 calculates months as cash divided by expenses during last 30 days", () => {
    expect(monthlyBandRunway(3000, 1000)).toBe(3);
    expect(monthlyBandRunway(500, 1000)).toBe(0.5);
    expect(monthlyBandRunway(-50, 1000)).toBe(0);
    expect(monthlyBandRunway(0, 1000)).toBe(0);
  });

  it("#4020 never displays cash balance as months of runway if expense history is unknown", () => {
    expect(monthlyBandRunway(5000, null)).toBeNull();
    expect(monthlyBandRunway(5000, 0)).toBeNull();
    expect(monthlyBandRunway(5000, Number.NaN)).toBeNull();
    expect(monthlyBandRunway(5000, Number.POSITIVE_INFINITY)).toBeNull();
  });
});
