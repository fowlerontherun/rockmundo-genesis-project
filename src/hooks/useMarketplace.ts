import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useMarketplace = (userId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: myListings = [], isLoading: listingsLoading } = useQuery({
    queryKey: ["marketplace-my-listings", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("marketplace_listings")
        .select(`
          *,
          song:songs(
            id,
            title,
            genre,
            mood,
            tempo,
            duration_seconds
          )
        `)
        .eq("seller_user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: myPurchases = [], isLoading: purchasesLoading } = useQuery({
    queryKey: ["marketplace-purchases", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("marketplace_transactions")
        .select(`
          *,
          listing:marketplace_listings(
            *,
            song:songs(
              id,
              title,
              genre,
              mood,
              tempo,
              duration_seconds
            )
          )
        `)
        .eq("buyer_user_id", userId)
        .order("transaction_date", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: royalties = [], isLoading: royaltiesLoading } = useQuery({
    queryKey: ["marketplace-royalties", userId],
    queryFn: async () => {
      if (!userId) return [];
      
      // For now return empty array until royalty system is fully implemented
      return [];
    },
    enabled: !!userId,
  });

  const createListingMutation = useMutation({
    mutationFn: async (listing: {
      song_id: string;
      listing_type: "fixed_price" | "auction";
      price?: number;
      starting_bid?: number;
      royalty_percentage?: number;
      auction_end_date?: string;
    }) => {
      if (!userId) throw new Error("User not authenticated");

      // Note: marketplace_listings table needs the following fields updated in schema
      const insertData: any = {
        asking_price: listing.price || listing.starting_bid || 0,
        listing_status: "active",
      };

      const { data, error } = await supabase
        .from("marketplace_listings")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-my-listings"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-listings"] });
      toast({
        title: "Listing Created",
        description: "Your song has been listed on the marketplace!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create Listing",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const cancelListingMutation = useMutation({
    mutationFn: async (listingId: string) => {
      const { error } = await supabase
        .from("marketplace_listings")
        .update({ listing_status: "cancelled" })
        .eq("id", listingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-my-listings"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-listings"] });
      toast({
        title: "Listing Cancelled",
        description: "Your listing has been removed from the marketplace.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Cancel",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const placeBidMutation = useMutation({
    mutationFn: async ({ listingId, bidAmount }: { listingId: string; bidAmount: number }) => {
      if (!userId) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("marketplace_bids")
        .insert({
          listing_id: listingId,
          bidder_user_id: userId,
          bid_amount: bidAmount,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-listings"] });
      toast({
        title: "Bid Placed",
        description: "Your bid has been submitted!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Place Bid",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    myListings,
    myPurchases,
    royalties,
    isLoading: listingsLoading || purchasesLoading || royaltiesLoading,
    createListing: createListingMutation.mutate,
    cancelListing: cancelListingMutation.mutate,
    placeBid: placeBidMutation.mutate,
    isCreatingListing: createListingMutation.isPending,
    isCancellingListing: cancelListingMutation.isPending,
    isPlacingBid: placeBidMutation.isPending,
  };
};
