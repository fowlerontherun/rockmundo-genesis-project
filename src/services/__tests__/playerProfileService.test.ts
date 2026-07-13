import { describe, expect, it } from "vitest";
import { __playerProfileServiceTestUtils, BIOGRAPHY_MAX_LENGTH } from "../playerProfileService";

const { sanitizeProfileText, sanitizeProfileList, validatePlayerProfileUpdate, calculateProfileCompleteness } = __playerProfileServiceTestUtils;

describe("player profile service", () => {
  it("sanitizes biography content and unsafe links", () => {
    const text = sanitizeProfileText('<script>alert(1)</script>Visit https://bad.example shit', BIOGRAPHY_MAX_LENGTH);
    expect(text).not.toContain("<script>");
    expect(text).toContain("[link removed]");
    expect(text).toContain("[moderated]");
  });

  it("normalizes profile arrays for public identity fields", () => {
    expect(sanitizeProfileList([" Guitar ", "Guitar", "Bass", "<b>Drums</b>"])).toEqual(["Guitar", "Bass", "Drums"]);
  });

  it("validates and trims editable availability settings", () => {
    const update = validatePlayerProfileUpdate({ profile_id: "p1", status_message: "  Looking for an indie-rock drummer in London.  ", preferred_genres: ["Indie Rock"] });
    expect(update.status_message).toBe("Looking for an indie-rock drummer in London.");
    expect(update.preferred_genres).toEqual(["Indie Rock"]);
  });

  it("calculates owner profile completeness suggestions", () => {
    const completeness = calculateProfileCompleteness({ biography: "Hi", primary_instrument: "Guitar", preferred_genres: ["Rock"], available_for_collaboration: true, visibility: "public" });
    expect(completeness.percent).toBe(100);
  });
});
