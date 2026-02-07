import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface MarketplaceListing {
  id: string;
  song_id: string;
  seller_user_id: string;
  listing_type: 'fixed_price' | 'auction';
  asking_price: number;
  buyout_price: number | null;
  current_bid: number | null;
  current_bidder_user_id: string | null;
  minimum_bid: number | null;
  royalty_percentage: number;
  listing_status: string;
  description: string | null;
  expires_at: string | null;
  seller_band_id: string | null;
  created_at: string;
  updated_at: string;
  songs?: {
    id: string;
    title: string;
    genre: string;
    quality_score: number;
    duration_display: string | null;
  } | null;
  bid_count?: number;
}

export interface MarketplaceBid {
  id: string;
  listing_id: string;
  bidder_user_id: string;
  bid_amount: number;
  bid_status: string;
  created_at: string;
}

export interface MarketplaceTransaction {
  id: string;
  listing_id: string;
  song_id: string;
  buyer_user_id: string;
  seller_user_id: string;
  sale_price: number;
  royalty_percentage: number;
  transaction_status: string;
  completed_at: string | null;
  created_at: string;
}

export const useSongAuctions = (userId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Browse active listings (excludes own)
  const { data: activeListings = [], isLoading: listingsLoading } = useQuery({
    queryKey: ["song-market-browse", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_listings")
        .select(`
          *,
          songs (
            id, title, genre, quality_score, duration_display
          )
        `)
        .eq("listing_status", "active")
        .order("created_at", { ascending: false });

      if (error) throw error;
      // Filter out own listings client-side
      return (data || []).filter((l: any) => 
        l.seller_user_id !== userId
      ) as unknown as MarketplaceListing[];
    },
    enabled: !!userId,
  });

  // My listings
  const { data: myListings = [], isLoading: myListingsLoading } = useQuery({
    queryKey: ["song-market-my-listings", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("marketplace_listings")
        .select(`
          *,
          songs (
            id, title, genre, quality_score, duration_display
          )
        `)
        .eq("seller_user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as MarketplaceListing[];
    },
    enabled: !!userId,
  });

  // My purchased songs
  const { data: purchasedSongs = [], isLoading: purchasesLoading } = useQuery({
    queryKey: ["song-market-purchases", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("songs")
        .select("id, title, genre, quality_score, duration_display, ownership_type")
        .eq("user_id", userId)
        .eq("ownership_type", "purchased")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // My sellable songs (owned, not purchased, not already listed)
  const { data: sellableSongs = [], isLoading: sellableLoading } = useQuery({
    queryKey: ["song-market-sellable", userId],
    queryFn: async () => {
      if (!userId) return [];

      // Get songs I own that are NOT purchased and NOT already listed
      const { data: songs, error } = await supabase
        .from("songs")
        .select("id, title, genre, quality_score, duration_display, status, market_listing_id, ownership_type")
        .eq("user_id", userId)
        .neq("ownership_type", "purchased")
        .in("status", ["draft", "recorded"])
        .neq("archived", true)
        .order("title");

      if (error) throw error;

      // Filter out already actively listed songs
      const { data: activeListings } = await supabase
        .from("marketplace_listings")
        .select("song_id")
        .eq("seller_user_id", userId)
        .eq("listing_status", "active");

      const activeSongIds = new Set((activeListings || []).map(l => l.song_id));
      return (songs || []).filter(s => !activeSongIds.has(s.id));
    },
    enabled: !!userId,
  });

  // Bids on a specific listing
  const fetchBids = async (listingId: string): Promise<MarketplaceBid[]> => {
    const { data, error } = await supabase
      .from("marketplace_bids")
      .select("*")
      .eq("listing_id", listingId)
      .order("bid_amount", { ascending: false });

    if (error) throw error;
    return (data || []) as MarketplaceBid[];
  };

  // Create a new listing
  const createListing = useMutation({
    mutationFn: async (params: {
      songId: string;
      listingType: 'fixed_price' | 'auction';
      askingPrice: number;
      buyoutPrice?: number;
      durationDays: number;
      description?: string;
      bandId?: string | null;
    }) => {
      if (!userId) throw new Error("Not authenticated");

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + params.durationDays);

      const { data, error } = await supabase
        .from("marketplace_listings")
        .insert({
          song_id: params.songId,
          seller_user_id: userId,
          seller_band_id: params.bandId || null,
          listing_type: params.listingType,
          asking_price: params.askingPrice,
          buyout_price: params.buyoutPrice || null,
          minimum_bid: params.listingType === 'auction' ? params.askingPrice : null,
          expires_at: expiresAt.toISOString(),
          description: params.description || null,
          listing_status: 'active',
          royalty_percentage: 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["song-market-my-listings"] });
      queryClient.invalidateQueries({ queryKey: ["song-market-browse"] });
      queryClient.invalidateQueries({ queryKey: ["song-market-sellable"] });
      toast({ title: "Song Listed!", description: "Your song is now on the marketplace." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to list", description: error.message, variant: "destructive" });
    },
  });

  // Place a bid using RPC
  const placeBid = useMutation({
    mutationFn: async ({ listingId, bidAmount }: { listingId: string; bidAmount: number }) => {
      if (!userId) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc("place_song_bid", {
        p_listing_id: listingId,
        p_bidder_user_id: userId,
        p_bid_amount: bidAmount,
      });

      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["song-market-browse"] });
      queryClient.invalidateQueries({ queryKey: ["song-market-my-listings"] });
      toast({ title: "Bid Placed!", description: "Your bid has been submitted." });
    },
    onError: (error: Error) => {
      toast({ title: "Bid Failed", description: error.message, variant: "destructive" });
    },
  });

  // Buy now (fixed price) or accept winning bid
  const completeSale = useMutation({
    mutationFn: async ({ listingId, salePrice }: { listingId: string; salePrice: number }) => {
      if (!userId) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc("complete_song_sale", {
        p_listing_id: listingId,
        p_buyer_user_id: userId,
        p_sale_price: salePrice,
      });

      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["song-market-browse"] });
      queryClient.invalidateQueries({ queryKey: ["song-market-my-listings"] });
      queryClient.invalidateQueries({ queryKey: ["song-market-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["song-market-sellable"] });
      toast({
        title: "Song Purchased!",
        description: `Paid $${result.sale_price?.toLocaleString()}. The song is now in your collection.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Purchase Failed", description: error.message, variant: "destructive" });
    },
  });

  // Cancel a listing
  const cancelListing = useMutation({
    mutationFn: async (listingId: string) => {
      const { error } = await supabase
        .from("marketplace_listings")
        .update({ listing_status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", listingId)
        .eq("seller_user_id", userId!);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["song-market-my-listings"] });
      queryClient.invalidateQueries({ queryKey: ["song-market-browse"] });
      queryClient.invalidateQueries({ queryKey: ["song-market-sellable"] });
      toast({ title: "Listing Cancelled" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to cancel", description: error.message, variant: "destructive" });
    },
  });

  // Accept highest bid (seller completes auction manually)
  const acceptBid = useMutation({
    mutationFn: async ({ listingId }: { listingId: string }) => {
      // Fetch the listing to get current bid info
      const { data: listing, error: listingError } = await supabase
        .from("marketplace_listings")
        .select("current_bid, current_bidder_user_id")
        .eq("id", listingId)
        .single();

      if (listingError) throw listingError;
      if (!listing?.current_bid || !listing?.current_bidder_user_id) {
        throw new Error("No bids to accept");
      }

      // Use the complete_song_sale RPC with the winning bidder
      const { data, error } = await supabase.rpc("complete_song_sale", {
        p_listing_id: listingId,
        p_buyer_user_id: listing.current_bidder_user_id,
        p_sale_price: listing.current_bid,
      });

      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["song-market-my-listings"] });
      queryClient.invalidateQueries({ queryKey: ["song-market-browse"] });
      queryClient.invalidateQueries({ queryKey: ["song-market-sellable"] });
      toast({
        title: "Sale Completed!",
        description: `Sold for $${result.sale_price?.toLocaleString()}. You earned $${result.seller_payout?.toLocaleString()}.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Sale Failed", description: error.message, variant: "destructive" });
    },
  });

  return {
    activeListings,
    myListings,
    purchasedSongs,
    sellableSongs,
    listingsLoading,
    myListingsLoading,
    purchasesLoading,
    sellableLoading,
    fetchBids,
    createListing,
    placeBid,
    completeSale,
    cancelListing,
    acceptBid,
  };
};
