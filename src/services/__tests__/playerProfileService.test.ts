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
  it("preserves omitted profile lists and nullable fields during a partial status update", () => {
    const update = validatePlayerProfileUpdate({ profile_id: "profile-one", status_message: "  Available for gigs  " });
    expect(update).toEqual({ profile_id: "profile-one", status_message: "Available for gigs" });
    expect(update).not.toHaveProperty("secondary_instruments");
    expect(update).not.toHaveProperty("preferred_genres");
    expect(update).not.toHaveProperty("preferred_roles");
    expect(update).not.toHaveProperty("songwriting_specialisms");
  });

  it("sanitizes only explicitly supplied preferences and allows intentional clearing", () => {
    const update = validatePlayerProfileUpdate({ profile_id: "profile-one", preferred_roles: [" Singer ", "Singer"], preferred_genres: [] });
    expect(update).toEqual({ profile_id: "profile-one", preferred_roles: ["Singer"], preferred_genres: [] });
  });

});
