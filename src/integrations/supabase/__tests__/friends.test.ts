import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc,
    from: vi.fn(),
  },
}));

const { sendFriendRequest, __friendRequestTestUtils } = await import("../friends");

const requestorProfileId = "11111111-1111-4111-8111-111111111111";
const addresseeProfileId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => vi.clearAllMocks());

describe("friend request safety service", () => {
  it("rejects invalid target profile IDs before backend writes", async () => {
    await expect(sendFriendRequest({ requestorProfileId, addresseeProfileId: "bad-id" })).rejects.toThrow("valid player");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends valid friend requests through the guarded RPC", async () => {
    rpc.mockResolvedValueOnce({
      data: { id: "friendship-1", requestor_id: requestorProfileId, addressee_id: addresseeProfileId, status: "pending" },
      error: null,
    });

    await expect(sendFriendRequest({ requestorProfileId, addresseeProfileId })).resolves.toMatchObject({ status: "pending" });
    expect(rpc).toHaveBeenCalledWith("send_friend_request", { target_profile_id: addresseeProfileId });
  });

  it("treats duplicate pending requests as a successful idempotent response", async () => {
    rpc.mockResolvedValueOnce({
      data: { id: "friendship-1", requestor_id: requestorProfileId, addressee_id: addresseeProfileId, status: "pending" },
      error: null,
    });

    await expect(sendFriendRequest({ requestorProfileId, addresseeProfileId })).resolves.toMatchObject({ id: "friendship-1" });
  });

  it("maps blocked or unauthorized backend failures to friendly errors", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "This player is not available for friend requests." } });

    await expect(sendFriendRequest({ requestorProfileId, addresseeProfileId })).rejects.toThrow("not available");
  });

  it("maps unauthenticated backend failures to friendly errors", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "Sign in with an active player profile before sending friend requests." } });

    await expect(sendFriendRequest({ requestorProfileId, addresseeProfileId })).rejects.toThrow("Sign in");
  });

  it("maps declined cooldown backend failures to friendly errors", () => {
    expect(__friendRequestTestUtils.friendlyFriendRequestError("That friend request was declined recently."))
      .toContain("declined recently");
  });
});
