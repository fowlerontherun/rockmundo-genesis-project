import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: rpcMock },
}));

import { cancelSongMarketplaceListing } from "./cancelSongMarketplaceListing";

describe("cancelSongMarketplaceListing", () => {
  beforeEach(() => rpcMock.mockReset());

  it("submits only the listing ID to the authenticated server RPC", async () => {
    rpcMock.mockResolvedValue({ data: { success: true }, error: null });
    await expect(cancelSongMarketplaceListing("listing-1")).resolves.toBeUndefined();
    expect(rpcMock).toHaveBeenCalledOnce();
    expect(rpcMock).toHaveBeenCalledWith("cancel_song_marketplace_listing", {
      p_listing_id: "listing-1",
    });
  });

  it.each([
    ["a completed sale", "Listing is no longer active"],
    ["an expired auction", "Listing has expired"],
    ["a listing with a bid", "Listing has a bid and cannot be cancelled"],
    ["a missing or foreign listing", "Listing not found or not owned by you"],
    ["a concurrent change", "Listing changed before cancellation"],
    ["a completed transaction", "Listing already has a completed sale"],
  ])("reports refusal for %s, not a successful cancellation", async (_case, message) => {
    rpcMock.mockResolvedValue({ data: { success: false, error: message }, error: null });
    await expect(cancelSongMarketplaceListing("listing-1")).rejects.toThrow(message);
  });

  it("rejects a zero-row or malformed success response", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    await expect(cancelSongMarketplaceListing("listing-1")).rejects.toThrow(
      "Listing could not be cancelled",
    );
  });

  it("propagates database failures", async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error("Database unavailable") });
    await expect(cancelSongMarketplaceListing("listing-1")).rejects.toThrow("Database unavailable");
  });
});
