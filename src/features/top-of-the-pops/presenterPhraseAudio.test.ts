import { describe, expect, it } from "vitest";
import { TOTP_REUSABLE_PRESENTER_PHRASES, buildTotpReusablePresenterIntro, matchTotpReusablePresenterPhrase, selectTotpReusablePresenterPhrase, totpReusablePresenterPhrase } from "./presenterPhraseAudio";

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

  it("selects context-aware phrases only when the context is known", () => {
    expect(selectTotpReusablePresenterPhrase({ rank: 8, stableKey: "demo", isNewEntry: true }).category).toBe("new_entry");
    expect(selectTotpReusablePresenterPhrase({ rank: 22, stableKey: "demo", chartMovement: 12 }).category).toBe("climber");
    expect(selectTotpReusablePresenterPhrase({ rank: 4, stableKey: "demo", isReturning: true }).category).toBe("returning");
    expect(selectTotpReusablePresenterPhrase({ rank: 1, stableKey: "demo" }).id).toBe("number-one-its");
  });

  it("matches an authored band-led line back to its reusable phrase", () => {
    expect(matchTotpReusablePresenterPhrase("And now, it's Shockmaster!", "Shockmaster")?.id).toBe("and-now-its");
    expect(matchTotpReusablePresenterPhrase("At number one, it's Untitled Audio!", "Untitled Audio")?.id).toBe("number-one-its");
    expect(matchTotpReusablePresenterPhrase("Christmas number one: Untitled Audio!", "Untitled Audio")).toBeNull();
  });

  it("is deterministic and keeps song titles out of the assembled line", () => {
    const first = buildTotpReusablePresenterIntro("Untitled Audio", { rank: 7, stableKey: "episode-42:band-1" });
    const second = buildTotpReusablePresenterIntro("Untitled Audio", { rank: 7, stableKey: "episode-42:band-1" });
    expect(second).toEqual(first);
    expect(first.script).toContain("Untitled Audio!");
    expect(first.script.toLowerCase()).not.toContain("song");
  });
});
