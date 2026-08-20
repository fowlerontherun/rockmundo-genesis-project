import { describe, expect, it } from "vitest";
import { availablePracticeHours, nextPracticeHour } from "../skillPracticeScheduling";

describe("skill practice slots", () => {
  const now = new Date(2026, 7, 20, 9, 15);

  it("defaults today to the next full future hour", () => {
    expect(nextPracticeHour(new Date(2026, 7, 20), now)).toBe(10);
  });

  it("does not expose past hours today", () => {
    expect(availablePracticeHours(new Date(2026, 7, 20), now)).toEqual(
      Array.from({ length: 14 }, (_, index) => index + 10),
    );
  });

  it("allows every hour on a future date", () => {
    expect(availablePracticeHours(new Date(2026, 7, 21), now)).toHaveLength(24);
  });

  it("reports no remaining slots after the last full-hour boundary", () => {
    expect(nextPracticeHour(new Date(2026, 7, 20), new Date(2026, 7, 20, 23, 1))).toBeNull();
  });
});
