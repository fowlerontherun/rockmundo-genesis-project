import { describe, expect, it } from "vitest";
import { clampTotpGain, totpMixLevels, TOTP_MIX_TARGET } from "./broadcastAudioMix";

describe("Top of the Pops audio mix", () => {
  it("targets broadcast loudness and peak ceilings", () => {
    expect(TOTP_MIX_TARGET).toEqual({ programmeLoudnessLufs: -14, truePeakCeilingDbtp: -1 });
  });

  it("ducks the song under presenter speech", () => {
    const presenter = totpMixLevels("presenter");
    const performance = totpMixLevels("performance");
    expect(presenter.songBed).toBeLessThan(performance.songBed);
    expect(presenter.presenter).toBeGreaterThan(presenter.songBed);
  });

  it("lifts the audience layer for a roaring studio without exceeding headroom", () => {
    const loud = totpMixLevels("audience", 10);
    expect(loud.audienceHit).toBeGreaterThan(totpMixLevels("audience", 0).audienceHit);
    expect(loud.audienceHit).toBeLessThanOrEqual(0.92);
  });

  it("keeps transition stings below the programme headroom", () => {
    expect(totpMixLevels("presenter").transitionSting).toBeLessThan(0.2);
    expect(totpMixLevels("graphic").transitionSting).toBeLessThan(0.2);
    expect(totpMixLevels("audience", 10).transitionSting).toBeLessThan(0.2);
  });

  it("is deterministic and tolerates bad reaction values", () => {
    expect(totpMixLevels("performance", Number.NaN)).toEqual(totpMixLevels("performance", 0));
    expect(clampTotpGain(Number.POSITIVE_INFINITY)).toBe(0.95);
    expect(clampTotpGain(-4)).toBe(0.02);
  });
});
