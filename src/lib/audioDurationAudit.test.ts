import { describe, expect, it } from "vitest";
import { audioDurationReviewStatus, audioGenerationMinimumStatus, formatAudioDuration, isGeneratedAudioShort } from "./audioDurationAudit";

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

it("keeps the current generation floor separate from planned song length", () => {
  expect(audioGenerationMinimumStatus(59.99)).toBe("BELOW_MINIMUM");
  expect(audioGenerationMinimumStatus(60)).toBe("MEETS_MINIMUM");
  expect(audioGenerationMinimumStatus(null)).toBe("UNVERIFIABLE");
  expect(audioGenerationMinimumStatus(83.9)).toBe("MEETS_MINIMUM");
  expect(audioDurationReviewStatus(83.9, 283)).toBe("SHORT_REVIEW");
});
