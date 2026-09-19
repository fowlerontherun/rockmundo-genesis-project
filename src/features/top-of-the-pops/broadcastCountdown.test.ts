import { describe, expect, it } from "vitest";
import {
  formatTotpCountdown,
  totpCountdownRemainingMs,
  totpCountdownSeconds,
  totpEasedProgress,
  totpTransitionDipOpacity,
} from "./broadcastCountdown";

describe("Top of the Pops broadcast countdown", () => {
  it("counts real remaining time down to zero", () => {
    expect(totpCountdownRemainingMs(5_000, 0)).toBe(5_000);
    expect(totpCountdownRemainingMs(5_000, 1_200)).toBe(3_800);
    expect(totpCountdownRemainingMs(5_000, 9_000)).toBe(0);
    expect(totpCountdownRemainingMs(5_000, Number.NaN)).toBe(5_000);
  });

  it("shows whole seconds while any fraction is still to run", () => {
    expect(totpCountdownSeconds(3_800)).toBe(4);
    expect(totpCountdownSeconds(1)).toBe(1);
    expect(totpCountdownSeconds(0)).toBe(0);
  });

  it("formats a broadcast clock label", () => {
    expect(formatTotpCountdown(4_200)).toBe("0:05");
    expect(formatTotpCountdown(0)).toBe("0:00");
    expect(formatTotpCountdown(61_000)).toBe("1:01");
  });

  it("eases transition progress without overshooting", () => {
    expect(totpEasedProgress(1_000, 0)).toBe(0);
    expect(totpEasedProgress(1_000, 500)).toBeCloseTo(0.5, 5);
    expect(totpEasedProgress(1_000, 2_000)).toBe(1);
  });

  it("dips to black at the start and end of a transition only", () => {
    expect(totpTransitionDipOpacity(2_800, 0)).toBe(1);
    expect(totpTransitionDipOpacity(2_800, 1_400)).toBe(0);
    expect(totpTransitionDipOpacity(2_800, 2_800)).toBe(1);
  });
});
