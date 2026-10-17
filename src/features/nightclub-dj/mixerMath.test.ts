import { describe, expect, it } from "vitest";
import { clampDeckRate, equalPowerCrossfade, formatDjTime, syncDeckRate } from "./mixerMath";

describe("DJ mixer mechanics", () => {
  it("mutes B at the left end and A at the right end", () => {
    expect(equalPowerCrossfade(0)).toEqual({ a: 0.75, b: 0 });
    const right = equalPowerCrossfade(100);
    expect(right.a).toBeCloseTo(0);
    expect(right.b).toBeCloseTo(0.75);
  });

  it("crossfades smoothly with headroom, clamps invalid input", () => {
    const centre = equalPowerCrossfade(50);
    expect(centre.a).toBeCloseTo(centre.b);
    expect(centre.a).toBeGreaterThan(0);
    expect(centre.a).toBeLessThan(0.75);
    expect(equalPowerCrossfade(-10)).toEqual(equalPowerCrossfade(0));
    expect(equalPowerCrossfade(150)).toEqual(equalPowerCrossfade(100));
    expect(equalPowerCrossfade(Number.NaN)).toEqual(equalPowerCrossfade(0));
  });

  it("keeps tempo within usable practice limits", () => {
    expect(clampDeckRate(0)).toBe(0.85);
    expect(clampDeckRate(4)).toBe(1.15);
    expect(clampDeckRate(Number.NaN)).toBe(1);
    expect(syncDeckRate(125, 125)).toBe(1);
    expect(syncDeckRate(125, 130)).toBeCloseTo(1.04);
    expect(syncDeckRate(90, 150)).toBeNull();
    expect(syncDeckRate(null, 130)).toBeNull();
  });

  it("formats positions without invalid timestamps", () => {
    expect(formatDjTime(125)).toBe("2:05");
    expect(formatDjTime(-1)).toBe("0:00");
    expect(formatDjTime(Number.NaN)).toBe("0:00");
  });
});
