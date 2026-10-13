import { beforeEach, describe, expect, it, vi } from "vitest";
import { listFriendSuggestions } from "../playerConnections";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mocks.rpc },
}));

beforeEach(() => mocks.rpc.mockReset());

describe("privacy-safe friend suggestions", () => {
  it("calls the owner-scoped server eligibility check instead of downloading raw profiles", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ id: "friend-a", display_name: "Artist A", city_name: null }],
      error: null,
    });
    const suggestions = await listFriendSuggestions("profile-a");
    expect(mocks.rpc).toHaveBeenCalledWith("get_safe_friend_suggestions", {
      p_profile_id: "profile-a",
      p_limit: 6,
    });
    expect(suggestions).toMatchObject([{
      id: "friend-a",
      status: "suggested",
      friendshipId: "",
      cityName: null,
      mutualFriendCount: null,
    }]);
    expect(suggestions[0].status).not.toBe("pending");
  });

  it("does not show any suggestions after a server-side block/privacy verification error", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("Block privacy check failed") });
    await expect(listFriendSuggestions("profile-a")).rejects.toThrow("Block privacy check failed");
  });

  it("rejects malformed responses rather than falling back to an unfiltered profile search", async () => {
    mocks.rpc.mockResolvedValue({ data: { unauthorized: true }, error: null });
    await expect(listFriendSuggestions("profile-a")).rejects.toThrow("invalid");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("does not request suggestions without a profile", async () => {
    expect(await listFriendSuggestions("")).toEqual([]);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
