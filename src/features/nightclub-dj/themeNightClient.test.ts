import { describe, expect, it } from "vitest";
import { parseThemeNightAttempt, resolveThemeNightAttempt, themeNightFingerprint } from "./themeNightClient";

const uuidA = "6942b012-8012-4fbc-bcc3-39f2d23af670";
const uuidB = "9a34c592-ac68-48cc-a6b9-cf5656238fd1";

describe("club-owner theme night request identity", () => {
  it("is stable for an identical owner, weekday, action, title and genre", () => {
    const fingerprint = themeNightFingerprint("club-1", 5, "set", "  Indie Friday ", " Rock ");
    const first = resolveThemeNightAttempt(null, fingerprint, () => uuidA);
    expect(resolveThemeNightAttempt(first, fingerprint, () => uuidB)).toEqual(first);
    expect(fingerprint).toBe(themeNightFingerprint("club-1", 5, "set", "Indie Friday", "Rock"));
  });

  it("rotates the key when the game weekday, title, genre, club or action changes", () => {
    const base = themeNightFingerprint("club-1", 5, "set", "Indie Friday", "Rock");
    const previous = { fingerprint: base, requestId: uuidA };
    for (const changed of [
      themeNightFingerprint("club-2", 5, "set", "Indie Friday", "Rock"),
      themeNightFingerprint("club-1", 6, "set", "Indie Friday", "Rock"),
      themeNightFingerprint("club-1", 5, "set", "New Name", "Rock"),
      themeNightFingerprint("club-1", 5, "set", "Indie Friday", "Jazz"),
      themeNightFingerprint("club-1", 5, "disable"),
    ]) {
      expect(resolveThemeNightAttempt(previous, changed, () => uuidB).requestId).toBe(uuidB);
    }
  });

  it("ignores stale content on disabled actions", () => {
    expect(themeNightFingerprint("club-1", 0, "disable", "Should ignore", "Jazz"))
      .toBe(themeNightFingerprint("club-1", 0, "disable"));
  });

  it("accepts persisted correctly-shaped attempts and rejects malformed values", () => {
    const fingerprint = themeNightFingerprint("club-1", 0, "disable");
    const good = { fingerprint, requestId: uuidA };
    expect(parseThemeNightAttempt(JSON.stringify(good))).toEqual(good);
    for (const invalid of [
      null, "", "undefined", "{", "{}", "[]",
      JSON.stringify({ fingerprint, requestId: "made-up" }),
      JSON.stringify({ fingerprint: 4, requestId: uuidA }),
    ]) {
      expect(parseThemeNightAttempt(invalid)).toBeNull();
    }
  });
});
