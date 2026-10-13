import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (relative: string) => readFileSync(
  fileURLToPath(new URL(relative, import.meta.url)), "utf8",
);
const repository = read("../playerConnections.ts");
const migration = read("../../../../supabase/migrations/20261013201000_private_friend_suggestions_mutual_counts.sql");
const card = read("../../../components/friends/FriendCard.tsx");
const page = read("../../../pages/Friends.tsx");

describe("friend connections audit batch", () => {
  it("#3947 excludes private, deceased, deleted and inactive suggestions at the DB boundary", () => {
    expect(repository).toContain('.rpc(');
    expect(repository).toContain('"get_safe_friend_suggestions"');
    expect(migration).toContain("JOIN public.player_profiles social ON social.profile_id=p.id");
    expect(migration).toContain("social.visibility::text='public'");
    expect(migration).toContain("p.deleted_at IS NULL");
    expect(migration).toContain("p.died_at IS NULL");
    expect(migration).toContain("p.is_active IS TRUE");
    expect(migration).toContain("p.user_id<>v_user_id");
  });

  it("#3948 never describes an unrequested suggestion as pending", () => {
    expect(repository).toContain('status: "suggested" as const');
    expect(repository).not.toContain('status: "pending", requestedAt: new Date()');
  });

  it("#3949 does not retrieve unrestricted cities in friendship joins or show hidden cities in suggestions", () => {
    expect(repository).not.toContain("avatar_url, city_name)");
    expect(repository).toContain("cityName: null, status: row.status");
    expect(migration).toContain("CASE WHEN social.show_city THEN p.city_name ELSE NULL END city_name");
  });

  it("#3953 uses a verified server aggregate instead of invented zero mutual counts", () => {
    expect(repository).toContain('"get_mutual_friend_counts"');
    expect(repository).toContain("friend.mutualFriendCount = value");
    expect(repository).toContain("mutualFriendCount: null");
    expect(card).toContain("friend.mutualFriendCount !== null");
    expect(migration).toContain("count(DISTINCT shared.friend_id)");
    expect(migration).toContain("direct.status='accepted'");
    expect(migration).toContain("viewer.user_id=auth.uid()");
    expect(migration).not.toContain("friend_id::text AS friend_name");
  });

  it("#3954 never falls back to an unverified blocked-player list", () => {
    expect(repository).toContain('if (error) throw error; // Denied / unavailable check must fail closed.');
    expect(migration).toContain("NOT EXISTS(");
    expect(migration).toContain("blocked.blocker_id=p_profile_id AND blocked.blocked_id=p.id");
    expect(migration).toContain("blocked.blocker_id=p.id AND blocked.blocked_id=p_profile_id");
    expect(page).toContain("Friend suggestions could not be verified safely.");
    expect(page).toContain("Retry suggestions");
  });

  it("fails migration preflight rather than constructing a privacy-unaware list", () => {
    expect(migration).toContain("FRIEND_SUGGESTIONS_REQUIRE_PLAYER_PROFILES");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.get_safe_friend_suggestions");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.get_mutual_friend_counts");
  });
});
