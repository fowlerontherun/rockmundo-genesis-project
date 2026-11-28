import { describe, expect, it } from "vitest";
import { getSongwritingProgressPercent, OPEN_SONGWRITING_PROJECT_STATUSES } from "./songwritingProgress";

describe("songwriting progress shared across dashboard and booking", () => {
  it("shows raw music and lyrics points as a bounded percentage of the real 2,000-point targets", () => {
    expect(getSongwritingProgressPercent({ music_progress: 0, lyrics_progress: 0 })).toBe(0);
    expect(getSongwritingProgressPercent({ music_progress: 1_000, lyrics_progress: 1_000 })).toBe(50);
    expect(getSongwritingProgressPercent({ music_progress: 2_000, lyrics_progress: 2_000 })).toBe(100);
    expect(getSongwritingProgressPercent({ music_progress: 4_000, lyrics_progress: -200 })).toBe(50);
    expect(getSongwritingProgressPercent({ music_progress: null, lyrics_progress: undefined })).toBe(0);
  });

  it("recognises the draft and writing states present in live songwriting projects", () => {
    expect(OPEN_SONGWRITING_PROJECT_STATUSES).toContain("draft");
    expect(OPEN_SONGWRITING_PROJECT_STATUSES).toContain("writing");
    expect(OPEN_SONGWRITING_PROJECT_STATUSES).not.toContain("completed");
    expect(OPEN_SONGWRITING_PROJECT_STATUSES).not.toContain("converted");
  });
});
