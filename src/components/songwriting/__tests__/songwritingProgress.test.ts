import { describe, expect, it } from "vitest";
import { songwritingProgressPercent } from "../songwritingProgress";

describe("songwriting progress bounds", () => {
  it("maps valid progress onto its 2,000 point scale", () => {
    expect(songwritingProgressPercent(0)).toBe(0);
    expect(songwritingProgressPercent(1000)).toBe(50);
    expect(songwritingProgressPercent(2000)).toBe(100);
    expect(songwritingProgressPercent(1001)).toBe(50);
    expect(songwritingProgressPercent(1025)).toBe(51);
  });

  it("never displays negative, excessive or malformed percentages", () => {
    expect(songwritingProgressPercent(-100)).toBe(0);
    expect(songwritingProgressPercent(5000)).toBe(100);
    expect(songwritingProgressPercent(Number.POSITIVE_INFINITY)).toBe(0);
    expect(songwritingProgressPercent(Number.NaN)).toBe(0);
    expect(songwritingProgressPercent(null)).toBe(0);
    expect(songwritingProgressPercent(undefined)).toBe(0);
    expect(songwritingProgressPercent(100, 0)).toBe(0);
  });
});
