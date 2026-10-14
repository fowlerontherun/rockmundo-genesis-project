import { describe, expect, it } from "vitest";
import { formatAudioDuration, isGeneratedAudioShort } from "./audioDurationAudit";

describe("generated audio quality thresholds", () => {
  it("flags a severe mismatch between intended and actual duration", () => {
    expect(isGeneratedAudioShort(11.5, 211)).toBe(true);
    expect(isGeneratedAudioShort(83.9, 283)).toBe(true);
    expect(isGeneratedAudioShort(220, 260)).toBe(false);
  });

  it("does not flag songs without an expected length", () => {
    expect(isGeneratedAudioShort(40, null)).toBe(false);
    expect(isGeneratedAudioShort(40, 0)).toBe(false);
  });

  it("formats actual audio metadata separately from song duration", () => {
    expect(formatAudioDuration(83.9)).toBe("1:24");
    expect(formatAudioDuration(null)).toBe("Unknown");
  });
});
