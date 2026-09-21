import { describe, expect, it } from "vitest";
import { TOTP_REUSABLE_PRESENTER_PHRASES, totpReusablePresenterPhrase } from "./presenterPhraseAudio";

describe("TOTP reusable presenter phrase library", () => {
  it("provides a varied reusable phrase bank without song-title placeholders", () => {
    expect(TOTP_REUSABLE_PRESENTER_PHRASES.length).toBeGreaterThanOrEqual(20);
    for (const phrase of TOTP_REUSABLE_PRESENTER_PHRASES) {
      expect(phrase.script.trim().length).toBeGreaterThan(0);
      expect(phrase.script.toLowerCase()).not.toContain("song title");
      expect(phrase.script).not.toContain("[BAND NAME]");
    }
  });

  it("covers the main automatic selection situations", () => {
    const categories = new Set(TOTP_REUSABLE_PRESENTER_PHRASES.map((phrase) => phrase.category));
    expect(categories).toEqual(new Set([
      "general",
      "new_entry",
      "climber",
      "returning",
      "top_ten",
      "number_one",
      "continuity",
    ]));
  });

  it("keeps stable IDs for key phrases", () => {
    expect(totpReusablePresenterPhrase("latest-entry-from")?.script).toBe("Here's the latest entry from");
    expect(totpReusablePresenterPhrase("another-smash-from")?.script).toBe("Here's another smash hit from");
    expect(totpReusablePresenterPhrase("number-one-its")?.script).toBe("At number one, it's");
  });
});
