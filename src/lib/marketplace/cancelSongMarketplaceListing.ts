import { supabase } from "@/integrations/supabase/client";

type CancelListingResult = { success?: boolean; error?: string };

/**
 * The server verifies auth.uid(), locks the listing, and rejects sold, expired,
 * settled or bid-backed listings. Never rely on a zero-row browser UPDATE.
 */
export const cancelSongMarketplaceListing = async (listingId: string): Promise<void> => {
  // Until the generated Supabase types include the new RPC, pass its arguments
  // through without weakening the rest of the typed database client.
  const { data, error } = await supabase.rpc(
    "cancel_song_marketplace_listing" as never,
    { p_listing_id: listingId } as never,
  );

  if (error) throw error;

  const result = data as CancelListingResult | null;
  if (result?.success !== true) {
    throw new Error(result?.error || "Listing could not be cancelled");
  }
};
