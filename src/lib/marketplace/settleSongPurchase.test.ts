import { describe, expect, it, vi } from "vitest";
import { settleSongPurchase } from "./settleSongPurchase";

const validReceipt = {
  success: true, transaction_id: "receipt-123", sale_price: 1700,
  marketplace_fee: 170, seller_payout: 1530,
};

describe("character-scoped server-authoritative song buying", () => {
  it("sends only the listing, selected character and buy action, never a browser price or buyer ID", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: validReceipt, error: null });
    await expect(settleSongPurchase(rpc, "listing-1", "character-1"))
      .resolves.toEqual(validReceipt);
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("settle_song_marketplace_sale_atomic", {
      p_listing_id: "listing-1", p_actor_profile_id: "character-1", p_action: "buy",
    });
    expect(Object.values(rpc.mock.calls[0][1])).not.toContain(validReceipt.sale_price);
  });

  it("blocks unresolved character/listing identity before reaching the money RPC", async () => {
    const rpc = vi.fn();
    await expect(settleSongPurchase(rpc, "listing-1", null)).rejects.toThrow("active character");
    await expect(settleSongPurchase(rpc, "", "character-1")).rejects.toThrow("Select a song listing");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not claim a purchase on RPC errors or malformed receipts", async () => {
    const errorRpc = vi.fn().mockResolvedValue({ data: null, error: { message: "song_sale_insufficient_cash" } });
    await expect(settleSongPurchase(errorRpc, "listing-1", "character-1"))
      .rejects.toThrow("song_sale_insufficient_cash");
    for (const data of [null, {}, { ...validReceipt, success: false },
      { ...validReceipt, sale_price: 0 }, { ...validReceipt, sale_price: "1700" }]) {
      const malformedRpc = vi.fn().mockResolvedValue({ data, error: null });
      await expect(settleSongPurchase(malformedRpc, "listing-1", "character-1"))
        .rejects.toThrow("receipt could not be verified");
    }
  });
});
