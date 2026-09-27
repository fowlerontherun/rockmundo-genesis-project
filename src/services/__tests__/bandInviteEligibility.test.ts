import { describe, expect, it } from "vitest";
import type { PublicProfileSearchResult } from "../publicProfileSearch";
import { bandInviteUnavailability, canShowBandInvite } from "../bandInviteEligibility";

const profile: PublicProfileSearchResult = {
  id: "22222222-2222-4222-8222-222222222222",
  user_id: "11111111-1111-4111-8111-111111111111",
  username: "guestguitarist",
  display_name: "Guest Guitarist",
  avatar_url: null,
  bio: null,
  fame: 0,
  fans: 0,
  level: 1,
  city_name: null,
  bands: [],
};
const context = {
  inviterProfileId: "33333333-3333-4333-8333-333333333333",
  inviterAccountId: "44444444-4444-4444-8444-444444444444",
  memberUserIds: new Set<string>(),
  pendingUserIds: new Set<string>(),
};

describe("band player invitation selection", () => {
  it("allows a discoverable non-friend who is not a member and has no invitation", () => {
    expect(bandInviteUnavailability(profile, context)).toBeNull();
  });

  it("excludes both the active character and other characters on the inviter's account", () => {
    expect(bandInviteUnavailability({ ...profile, id: context.inviterProfileId }, context)).toBe("Your own character");
    expect(bandInviteUnavailability({ ...profile, user_id: context.inviterAccountId }, context)).toBe("Your own character");
  });

  it("marks existing members and players with pending invitations", () => {
    expect(bandInviteUnavailability(profile, { ...context, memberUserIds: new Set([profile.user_id]) })).toBe("Already a band member");
    expect(bandInviteUnavailability(profile, { ...context, pendingUserIds: new Set([profile.user_id]) })).toBe("Invitation pending");
  });

  it("leaves non-active or unspecified band statuses to the authoritative backend", () => {
    expect(bandInviteUnavailability({
      ...profile,
      bands: [{ name: "Hiatus Band", genre: "Rock" }],
    }, context)).toBeNull();
  });
});

describe("recruiter invite visibility", () => {
  it.each(["leader", "founder", "co-leader", "co_leader", "manager", "recruiter"])(
    "shows the action to active %s band officers", (role) => {
      expect(canShowBandInvite({ isLeader: false, role, bandStatus: "active", isSoloArtist: false })).toBe(true);
    },
  );
  it("hides invitations from ordinary members, hiatus bands and solo artists", () => {
    expect(canShowBandInvite({ isLeader: false, role: "member", bandStatus: "active", isSoloArtist: false })).toBe(false);
    expect(canShowBandInvite({ isLeader: true, bandStatus: "hiatus", isSoloArtist: false })).toBe(false);
    expect(canShowBandInvite({ isLeader: true, bandStatus: "active", isSoloArtist: true })).toBe(false);
  });
});
