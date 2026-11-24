export interface SongPurchaseReceipt {
  success: true;
  transaction_id: string;
  sale_price: number;
  marketplace_fee: number;
  seller_payout: number;
}

type PurchaseRpc = (
  name: "settle_song_marketplace_sale_atomic",
  args: { p_listing_id: string; p_actor_profile_id: string; p_action: "buy" },
) => Promise<{ data: unknown; error: { message: string } | null }>;

/**
 * Buy-now and auction buyouts are priced and settled by the authenticated SQL
 * RPC. The client never supplies a buyer account or purchase amount. Auction
 * winning-bid acceptance remains disabled until the escrow work in #4230.
 */
export async function settleSongPurchase(
  rpc: PurchaseRpc,
  listingId: string,
  activeProfileId: string | null | undefined,
): Promise<SongPurchaseReceipt> {
  if (!activeProfileId) throw new Error("Choose an active character before buying a song");
  if (!listingId) throw new Error("Select a song listing before purchasing");

  const { data, error } = await rpc("settle_song_marketplace_sale_atomic", {
    p_listing_id: listingId,
    p_actor_profile_id: activeProfileId,
    p_action: "buy",
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("The song purchase receipt could not be verified");
  }
  const receipt = data as Record<string, unknown>;
  if (receipt.success !== true || typeof receipt.transaction_id !== "string" ||
      typeof receipt.sale_price !== "number" || !Number.isSafeInteger(receipt.sale_price) ||
      receipt.sale_price <= 0 || typeof receipt.marketplace_fee !== "number" ||
      typeof receipt.seller_payout !== "number") {
    throw new Error("The song purchase receipt could not be verified");
  }
  return receipt as unknown as SongPurchaseReceipt;
}
