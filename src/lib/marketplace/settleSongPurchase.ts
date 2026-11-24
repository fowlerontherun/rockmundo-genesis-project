export interface SongPurchaseReceipt {
  success: true;
  transaction_id: string;
  sale_price: number;
  marketplace_fee: number;
  seller_payout: number;
}

type PurchaseRpc = (
  name: "complete_song_sale",
  args: { p_listing_id: string; p_buyer_user_id: string; p_sale_price: number },
) => Promise<{ data: unknown; error: { message: string } | null }>;

/**
 * The authenticated SQL RPC derives the active buyer character and canonical
 * price, then requires an exact match to the buyer's confirmed price. The
 * supplied account/price are authorization/consent checks, NEVER settlement
 * authority. The newer profile-scoped RPC currently lacks this price-consent
 * comparison, so it must not replace this path until that guard is available.
 */
export async function settleSongPurchase(
  rpc: PurchaseRpc,
  listingId: string,
  activeProfileId: string | null | undefined,
  buyerUserId: string | null | undefined,
  expectedPrice: number,
): Promise<SongPurchaseReceipt> {
  if (!activeProfileId) throw new Error("Choose an active character before buying a song");
  if (!buyerUserId) throw new Error("Sign in before buying a song");
  if (!listingId) throw new Error("Select a song listing before purchasing");
  if (!Number.isSafeInteger(expectedPrice) || expectedPrice <= 0) {
    throw new Error("The displayed song price is invalid. Refresh the listing before buying");
  }

  const { data, error } = await rpc("complete_song_sale", {
    p_listing_id: listingId,
    p_buyer_user_id: buyerUserId,
    p_sale_price: expectedPrice,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("The song purchase receipt could not be verified");
  }
  const receipt = data as Record<string, unknown>;
  if (receipt.success !== true) {
    throw new Error(typeof receipt.error === "string" ? receipt.error : "The song purchase receipt could not be verified");
  }
  if (typeof receipt.transaction_id !== "string" ||
      typeof receipt.sale_price !== "number" || !Number.isSafeInteger(receipt.sale_price) ||
      receipt.sale_price <= 0 || typeof receipt.marketplace_fee !== "number" ||
      typeof receipt.seller_payout !== "number" || receipt.sale_price !== expectedPrice) {
    throw new Error("The song purchase receipt could not be verified");
  }
  return receipt as unknown as SongPurchaseReceipt;
}
