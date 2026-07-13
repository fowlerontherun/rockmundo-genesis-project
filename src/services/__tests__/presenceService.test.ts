import { describe, expect, it } from "vitest";
import { describeActivity, mergePresenceProfiles, normalizePresenceState } from "../presenceService";

describe("presenceService", () => {
  it("normalizes gameplay activities into consistent presence states", () => {
    expect(normalizePresenceState("travel", "active", false)).toBe("travelling");
    expect(normalizePresenceState("studio_recording", "active", false)).toBe("recording");
    expect(normalizePresenceState("band_rehearsal", "active", false)).toBe("rehearsing");
    expect(normalizePresenceState("gig", "performing", false)).toBe("performing");
    expect(normalizePresenceState(null, null, true)).toBe("online");
  });

  it("keeps recently seen players out of the offline bucket", () => {
    expect(normalizePresenceState(null, null, false, new Date().toISOString())).toBe("recently_online");
  });

  it("builds privacy-safe activity summaries from public metadata", () => {
    expect(describeActivity({ profile_id: "p1", activity_type: "recording", status: "active", metadata: { song_title: "Static Hearts" } })).toBe("Recording “Static Hearts”");
    expect(describeActivity({ profile_id: "p1", activity_type: "travel", status: "active", metadata: { destination_city_name: "London" } })).toBe("Travelling to London");
  });

  it("merges profiles, realtime presence, activity status and collaboration availability", () => {
    const players = mergePresenceProfiles(
      [{ id: "p1", user_id: "u1", username: "riley", city_name: "London", looking_for_band: true }],
      [{ profile_id: "p1", activity_type: "practice", status: "active", metadata: { skill_name: "guitar" } }],
      new Set(["u1"]),
    );
    expect(players[0]).toMatchObject({ id: "p1", presence: "rehearsing", activity: "Practising guitar", availableForCollaboration: true });
  });
});
