import { describe, expect, it } from "vitest";
import { chooseActiveBandMembership } from "./activeBandMembership";

const membership = {
  band_id: "band-1",
  profile_id: "profile-1",
  user_id: "user-1",
  member_status: "active",
  is_touring_member: false,
  joined_at: "2026-01-01T00:00:00Z",
};

describe("chooseActiveBandMembership", () => {
  it("recognises legacy active membership rows with nullable flags", () => {
    const result = chooseActiveBandMembership(
      [{ ...membership, member_status: null, is_touring_member: null }],
      new Set(["band-1"]),
      "profile-1",
    );

    expect(result?.band_id).toBe("band-1");
  });

  it("prefers the active character membership over a user-level legacy row", () => {
    const result = chooseActiveBandMembership(
      [
        { ...membership, band_id: "legacy-band", profile_id: null },
        membership,
      ],
      new Set(["band-1", "legacy-band"]),
      "profile-1",
    );

    expect(result?.band_id).toBe("band-1");
  });

  it("excludes former members, touring musicians, and inactive bands", () => {
    const result = chooseActiveBandMembership(
      [
        { ...membership, member_status: "left" },
        { ...membership, band_id: "band-2", is_touring_member: true },
        { ...membership, band_id: "inactive-band" },
      ],
      new Set(["band-1", "band-2"]),
      "profile-1",
    );

    expect(result).toBeNull();
  });
});
