import { describe, expect, it } from "vitest";
import { changedDjTempoPercent, clampDeckRate, deckAudioSourceKey, deckRatePercent, equalPowerCrossfade, formatDjTime, syncDeckRate } from "./mixerMath";

describe("DJ mixer mechanics", () => {
  it("mutes B at the left end and A at the right end", () => {
    expect(equalPowerCrossfade(0)).toEqual({ a: 0.7, b: 0 });
    const right = equalPowerCrossfade(100);
    expect(right.a).toBeCloseTo(0);
    expect(right.b).toBeCloseTo(0.7);
  });

  it("crossfades smoothly with headroom, clamps invalid input", () => {
    const centre = equalPowerCrossfade(50);
    expect(centre.a).toBeCloseTo(centre.b);
    expect(centre.a).toBeGreaterThan(0);
    expect(centre.a).toBeLessThan(0.7);
    expect(centre.a + centre.b).toBeLessThan(1);
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

  it("keeps playback running across metadata-only catalogue refreshes", () => {
    const original = {
      id: "game:song1", sourceId: "song1",
      audioUrl: "https://audio.example/song1.mp3", storagePath: null,
      title: "Original title", bpm: 120,
    };
    expect(deckAudioSourceKey({ ...original, title: "Renamed", bpm: 130 }))
      .toBe(deckAudioSourceKey(original));
    expect(deckAudioSourceKey({ ...original, audioUrl: "https://audio.example/new.mp3" }))
      .not.toBe(deckAudioSourceKey(original));
    expect(deckAudioSourceKey({ ...original, id: "game:song2", sourceId: "song2" }))
      .not.toBe(deckAudioSourceKey(original));
    expect(deckAudioSourceKey({ ...original, storagePath: "catalog/version2.mp3" }))
      .not.toBe(deckAudioSourceKey(original));
    expect(deckAudioSourceKey(null)).toBe("unloaded");
    expect(deckAudioSourceKey(original)).not.toBe(deckAudioSourceKey(null));
  });

  it("auto-sync commits a server-valid tempo percentage only for a real change", () => {
    expect(deckRatePercent(1)).toBe(100);
    expect(deckRatePercent(0.85)).toBe(85);
    expect(deckRatePercent(1.15)).toBe(115);
    expect(deckRatePercent(Number.NaN)).toBe(100);
    expect(changedDjTempoPercent(1, 1)).toBeNull();
    expect(changedDjTempoPercent(1, 1.001)).toBeNull();
    expect(changedDjTempoPercent(1, 1.05)).toBe(105);
    expect(changedDjTempoPercent(1.14, 1.15)).toBe(115);
  });

  it("formats positions without invalid timestamps", () => {
    expect(formatDjTime(125)).toBe("2:05");
    expect(formatDjTime(-1)).toBe("0:00");
    expect(formatDjTime(Number.NaN)).toBe("0:00");
  });
});
