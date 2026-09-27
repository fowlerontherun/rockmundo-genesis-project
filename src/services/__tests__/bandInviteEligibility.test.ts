import { describe, expect, it } from "vitest";
import type { PublicProfileSearchResult } from "../publicProfileSearch";
import { bandInviteUnavailability } from "../bandInviteEligibility";

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

  it("does not offer players with active band membership", () => {
    expect(bandInviteUnavailability({
      ...profile,
      bands: [{ name: "Another Band", genre: "Rock" }],
    }, context)).toBe("Already in another band");
  });
});
