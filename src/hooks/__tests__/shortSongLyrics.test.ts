import { describe, expect, it } from "vitest";
import { compactLyricsForShortAudio } from "../../../supabase/functions/_shared/shortSongLyrics";

describe("compact radio edit lyrics", () => {
  it("retains verse and chorus even after a long introduction", () => {
    const raw = "[Intro]\n" + "Instrumental opening\n".repeat(40) +
      "[Verse]\nUnder the lights\nOut in the city\nTonight is ours\n" +
      "[Chorus]\nKeep on singing\nKeep on dancing";
    const result = compactLyricsForShortAudio(raw)!;
    expect(result).toContain("[Verse]");
    expect(result).toContain("[Chorus]");
    expect(result).toContain("Keep on singing");
    expect(result.length).toBeLessThanOrEqual(580);
  });

  it("does not alter source lyrics", () => {
    const input = "[Verse]\nOriginal line\n[Chorus]\nOriginal chorus";
    expect(compactLyricsForShortAudio(input)).toContain("Original chorus");
    expect(input).toContain("Original line");
    expect(compactLyricsForShortAudio(null)).toBeNull();
  });
});
