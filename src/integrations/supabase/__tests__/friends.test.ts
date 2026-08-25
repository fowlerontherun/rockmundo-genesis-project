import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");

const rpc = vi.fn();
const from = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc, from },
}));

const {
  sendFriendRequest,
  updateFriendshipStatus,
  deleteFriendship,
  removeFriendship,
  blockProfile,
  unblockProfile,
  __friendRequestTestUtils,
} = await import("../friends");

const requestorProfileId = "11111111-1111-4111-8111-111111111111";
const addresseeProfileId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => vi.clearAllMocks());

describe("authoritative friendship lifecycle", () => {
  it("rejects invalid target profile IDs before backend writes", async () => {
    await expect(sendFriendRequest({ requestorProfileId, addresseeProfileId: "bad-id" })).rejects.toThrow("valid player");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends friend requests as the selected character through RPC only", async () => {
    rpc.mockResolvedValueOnce({
      data: { id: "friendship-1", requestor_id: requestorProfileId, addressee_id: addresseeProfileId, status: "pending" },
      error: null,
    });

    await expect(sendFriendRequest({ requestorProfileId, addresseeProfileId })).resolves.toMatchObject({ status: "pending" });
    expect(rpc).toHaveBeenCalledWith("send_friend_request", {
      target_profile_id: addresseeProfileId,
      requestor_profile_id: requestorProfileId,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("fails closed when the authoritative RPC is unavailable", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "Could not find the function public.send_friend_request" } });
    await expect(sendFriendRequest({ requestorProfileId, addresseeProfileId })).rejects.toThrow("send_friend_request");
    expect(from).not.toHaveBeenCalled();
  });

  it("routes accept/decline/remove/cancel through the selected-character RPC", async () => {
    rpc.mockResolvedValue({ data: { id: "friendship-1", status: "accepted" }, error: null });
    await updateFriendshipStatus("friendship-1", "accepted", requestorProfileId);
    await deleteFriendship("friendship-1", requestorProfileId);
    await removeFriendship("friendship-1", requestorProfileId);

    expect(rpc).toHaveBeenNthCalledWith(1, "respond_to_friend_request", {
      friendship_id: "friendship-1",
      next_status: "accepted",
      actor_profile_id: requestorProfileId,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "respond_to_friend_request", {
      friendship_id: "friendship-1",
      next_status: "cancelled",
      actor_profile_id: requestorProfileId,
    });
    expect(rpc).toHaveBeenNthCalledWith(3, "respond_to_friend_request", {
      friendship_id: "friendship-1",
      next_status: "removed",
      actor_profile_id: requestorProfileId,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("routes block and unblock through selected-character RPCs", async () => {
    rpc.mockResolvedValueOnce({ data: { id: "block-1" }, error: null });
    rpc.mockResolvedValueOnce({ data: true, error: null });

    await blockProfile(addresseeProfileId, requestorProfileId, "private note");
    await expect(unblockProfile(addresseeProfileId, requestorProfileId)).resolves.toBe(true);

    expect(rpc).toHaveBeenNthCalledWith(1, "block_profile", {
      target_profile_id: addresseeProfileId,
      actor_profile_id: requestorProfileId,
      note: "private note",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "unblock_profile", {
      target_profile_id: addresseeProfileId,
      actor_profile_id: requestorProfileId,
    });
  });

  it("maps blocked, auth and declined-cooldown failures to useful messages", () => {
    expect(__friendRequestTestUtils.friendlyFriendRequestError("This player is unavailable")).toContain("not available");
    expect(__friendRequestTestUtils.friendlyFriendRequestError("Not authenticated")).toContain("Sign in");
    expect(__friendRequestTestUtils.friendlyFriendRequestError("Friend request declined recently")).toContain("declined recently");
  });
});
