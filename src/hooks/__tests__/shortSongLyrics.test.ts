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
  it("retains a bridge and outro in a bounded complete performance", () => {
    const input = "[Intro]\n" + "Long opening\n".repeat(25) +
      "[Verse 1]\nThe road is always calling\nAnother day of falling\nWe stand together now\n" +
      "[Chorus]\nCome back home to me\nWe sing across the sea\nNever let the music die\n" +
      "[Verse 2]\nA shadow in the morning\nThe evening bells are ringing\n" +
      "[Bridge]\nAn entirely new beginning\nWe start to hear the singing\n" +
      "[Outro]\nWe will see the sunrise";
    const output = compactLyricsForShortAudio(input)!;
    expect(output).toContain("[Verse]");
    expect(output).toContain("[Chorus]");
    expect(output).toContain("[Bridge]");
    expect(output).toContain("[Outro]");
    expect(output).not.toContain("Long opening");
    expect(output.length).toBeLessThanOrEqual(580);
    expect(input).toContain("[Intro]");
  });
  it("requests longer complete source performances for both generation flows", () => {
    const { readFileSync } = require("node:fs");
    const { resolve } = require("node:path");
    for (const path of ["supabase/functions/generate-song-audio/index.ts", "supabase/functions/admin-generate-song-audio/index.ts"]) {
      const file = readFileSync(resolve(process.cwd(), path), "utf8");
      expect(file).toContain("complete song around 110 seconds");
      expect(file).toContain("const durationSeconds = 110");
    }
  });
});
