import { describe, expect, it, vi } from "vitest";
import { settleSongPurchase } from "./settleSongPurchase";

const validReceipt = {
  success: true, transaction_id: "receipt-123", sale_price: 1700,
  marketplace_fee: 170, seller_payout: 1530,
};

describe("character-scoped server-authoritative song buying", () => {
  it("passes the buyer-approved price as an equality guard, not settlement authority", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: validReceipt, error: null });
    await expect(settleSongPurchase(rpc, "listing-1", "character-1", "account-1", 1700))
      .resolves.toEqual(validReceipt);
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("complete_song_sale", {
      p_listing_id: "listing-1", p_buyer_user_id: "account-1", p_sale_price: 1700,
    });
  });

  it("blocks unresolved character/listing identity before reaching the money RPC", async () => {
    const rpc = vi.fn();
    await expect(settleSongPurchase(rpc, "listing-1", null, "account-1", 1700)).rejects.toThrow("active character");
    await expect(settleSongPurchase(rpc, "", "character-1", "account-1", 1700)).rejects.toThrow("Select a song listing");
    await expect(settleSongPurchase(rpc, "listing-1", "character-1", null, 1700)).rejects.toThrow("Sign in");
    await expect(settleSongPurchase(rpc, "listing-1", "character-1", "account-1", 0)).rejects.toThrow("price is invalid");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not claim a purchase on RPC errors or malformed receipts", async () => {
    const errorRpc = vi.fn().mockResolvedValue({ data: null, error: { message: "song_sale_insufficient_cash" } });
    await expect(settleSongPurchase(errorRpc, "listing-1", "character-1", "account-1", 1700))
      .rejects.toThrow("song_sale_insufficient_cash");
    for (const data of [null, {}, { ...validReceipt, success: false },
      { ...validReceipt, sale_price: 0 }, { ...validReceipt, sale_price: "1700" },
      { ...validReceipt, sale_price: 1900 }]) {
      const malformedRpc = vi.fn().mockResolvedValue({ data, error: null });
      await expect(settleSongPurchase(malformedRpc, "listing-1", "character-1", "account-1", 1700))
        .rejects.toThrow("receipt could not be verified");
    }
  });
});
