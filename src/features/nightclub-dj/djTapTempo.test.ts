import { describe, expect, it } from "vitest";
import { addDjSourceTempoTap, estimateDjSourceBpmFromTaps } from "./djTapTempo";

describe("DJ manual tap tempo uses source-media time", () => {
  it("derives usable source BPM after four taps, regardless of playbackRate", () => {
    let taps: number[] = [];
    for (const seconds of [10, 10.5, 11, 11.5]) taps = addDjSourceTempoTap(taps, seconds);
    expect(estimateDjSourceBpmFromTaps(taps)).toBe(120);
    expect(estimateDjSourceBpmFromTaps(taps.slice(0, 3))).toBeNull();
    // The player may play at 110%, but source time between actual source
    // beats still measures 0.5 seconds.
    const sourceTimes = [5, 5.5, 6, 6.5];
    expect(estimateDjSourceBpmFromTaps(sourceTimes)).toBe(120);
  });

  it("starts fresh after a gap or a manual seek/loop back", () => {
    const taps = [10, 10.5, 11, 11.5];
    expect(addDjSourceTempoTap(taps, 17)).toEqual([17]);
    expect(addDjSourceTempoTap(taps, 2)).toEqual([2]);
    expect(addDjSourceTempoTap(taps, 11.5)).toEqual([11.5]);
  });

  it("rejects accidental double taps and keeps at most seven source timestamps", () => {
    const original = [5, 5.5, 6];
    expect(addDjSourceTempoTap(original, 6.1)).toEqual(original);
    expect(original).toEqual([5, 5.5, 6]);
    let taps: number[] = [];
    for (let i = 0; i < 20; i++) taps = addDjSourceTempoTap(taps, 10 + i * 0.5);
    expect(taps).toHaveLength(7);
    expect(estimateDjSourceBpmFromTaps(taps)).toBe(120);
  });

  it("uses a robust median when one beat tap is late", () => {
    const taps = [0, .5, 1, 1.65, 2.15, 2.65];
    expect(estimateDjSourceBpmFromTaps(taps)).toBe(120);
  });

  it("requires finite, ordered plausible intervals and never invents a BPM", () => {
    expect(addDjSourceTempoTap([3], Number.NaN)).toEqual([3]);
    expect(addDjSourceTempoTap([], Number.NEGATIVE_INFINITY)).toEqual([]);
    expect(estimateDjSourceBpmFromTaps([1, 1.5, Number.NaN, 2])).toBeNull();
    expect(estimateDjSourceBpmFromTaps([1, 2, 1.5, 3])).toBeNull();
    expect(estimateDjSourceBpmFromTaps([0, .1, .2, .3])).toBeNull();
    expect(estimateDjSourceBpmFromTaps([])).toBeNull();
  });
});
