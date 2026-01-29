import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface GearListing {
  id: string;
  seller_user_id: string;
  player_equipment_id: string;
  equipment_id: string;
  listing_status: string;
  asking_price: number;
  min_acceptable_price: number | null;
  allow_negotiation: boolean;
  condition_at_listing: number;
  condition_description: string | null;
  description: string | null;
  featured: boolean;
  view_count: number;
  created_at: string;
  expires_at: string | null;
  equipment: {
    id: string;
    name: string;
    brand: string | null;
    category: string;
    subcategory: string | null;
    base_price: number;
    quality_rating: number;
    rarity: string | null;
    description: string | null;
    stat_boosts: any;
    image_url: string | null;
  };
  seller_profile?: {
    stage_name: string | null;
  };
}

export interface GearOffer {
  id: string;
  listing_id: string;
  buyer_user_id: string;
  offer_amount: number;
  message: string | null;
  status: string;
  counter_amount: number | null;
  counter_message: string | null;
  created_at: string;
  responded_at: string | null;
}

export const useGearMarketplace = (userId?: string) => {
  const queryClient = useQueryClient();

  // Fetch all active listings
  const { data: listings = [], isLoading: listingsLoading } = useQuery({
    queryKey: ["gear-marketplace-listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gear_marketplace_listings")
        .select(`
          *,
          equipment:equipment_catalog(
            id, name, brand, category, subcategory, base_price, 
            quality_rating, rarity, description, stat_boosts, image_url
          )
        `)
        .eq("listing_status", "active")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as GearListing[];
    },
  });

  // Fetch user's own listings
  const { data: myListings = [], isLoading: myListingsLoading } = useQuery({
    queryKey: ["gear-marketplace-my-listings", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("gear_marketplace_listings")
        .select(`
          *,
          equipment:equipment_catalog(
            id, name, brand, category, subcategory, base_price, 
            quality_rating, rarity, description, stat_boosts, image_url
          )
        `)
        .eq("seller_user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as GearListing[];
    },
    enabled: !!userId,
  });

  // Fetch user's purchase history
  const { data: myPurchases = [], isLoading: purchasesLoading } = useQuery({
    queryKey: ["gear-marketplace-purchases", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("gear_marketplace_transactions")
        .select(`
          *,
          listing:gear_marketplace_listings(
            *,
            equipment:equipment_catalog(*)
          )
        `)
        .eq("buyer_user_id", userId)
        .order("transaction_date", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // Fetch offers on user's listings
  const { data: receivedOffers = [], isLoading: offersLoading } = useQuery({
    queryKey: ["gear-marketplace-received-offers", userId],
    queryFn: async () => {
      if (!userId) return [];

      // Get offers on listings where user is seller
      const { data: listings } = await supabase
        .from("gear_marketplace_listings")
        .select("id")
        .eq("seller_user_id", userId);

      if (!listings?.length) return [];

      const listingIds = listings.map(l => l.id);

      const { data, error } = await supabase
        .from("gear_marketplace_offers")
        .select("*")
        .in("listing_id", listingIds)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as GearOffer[];
    },
    enabled: !!userId,
  });

  // Create listing mutation
  const createListingMutation = useMutation({
    mutationFn: async (params: {
      playerEquipmentId: string;
      equipmentId: string;
      askingPrice: number;
      minAcceptablePrice?: number;
      allowNegotiation?: boolean;
      condition: number;
      conditionDescription?: string;
      description?: string;
    }) => {
      if (!userId) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("gear_marketplace_listings")
        .insert({
          seller_user_id: userId,
          player_equipment_id: params.playerEquipmentId,
          equipment_id: params.equipmentId,
          asking_price: params.askingPrice,
          min_acceptable_price: params.minAcceptablePrice,
          allow_negotiation: params.allowNegotiation ?? true,
          condition_at_listing: params.condition,
          condition_description: params.conditionDescription,
          description: params.description,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gear-marketplace-listings"] });
      queryClient.invalidateQueries({ queryKey: ["gear-marketplace-my-listings"] });
      queryClient.invalidateQueries({ queryKey: ["player-equipment"] });
      toast.success("Gear listed on marketplace!");
    },
    onError: (error: any) => {
      toast.error("Failed to list gear", { description: error.message });
    },
  });

  // Cancel listing mutation
  const cancelListingMutation = useMutation({
    mutationFn: async (listingId: string) => {
      const { error } = await supabase
        .from("gear_marketplace_listings")
        .update({ listing_status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", listingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gear-marketplace-listings"] });
      queryClient.invalidateQueries({ queryKey: ["gear-marketplace-my-listings"] });
      toast.success("Listing cancelled");
    },
    onError: (error: any) => {
      toast.error("Failed to cancel listing", { description: error.message });
    },
  });

  // Buy gear mutation
  const buyGearMutation = useMutation({
    mutationFn: async (params: { listingId: string; price: number }) => {
      if (!userId) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc("process_gear_sale", {
        p_listing_id: params.listingId,
        p_buyer_user_id: userId,
        p_sale_price: params.price,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gear-marketplace-listings"] });
      queryClient.invalidateQueries({ queryKey: ["gear-marketplace-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["player-equipment"] });
      queryClient.invalidateQueries({ queryKey: ["game-data"] });
      toast.success("Purchase complete! Gear added to your inventory.");
    },
    onError: (error: any) => {
      toast.error("Purchase failed", { description: error.message });
    },
  });

  // Make offer mutation
  const makeOfferMutation = useMutation({
    mutationFn: async (params: { listingId: string; offerAmount: number; message?: string }) => {
      if (!userId) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("gear_marketplace_offers")
        .insert({
          listing_id: params.listingId,
          buyer_user_id: userId,
          offer_amount: params.offerAmount,
          message: params.message,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Offer submitted!");
    },
    onError: (error: any) => {
      toast.error("Failed to submit offer", { description: error.message });
    },
  });

  // Respond to offer mutation
  const respondToOfferMutation = useMutation({
    mutationFn: async (params: { offerId: string; accept: boolean; counterAmount?: number; counterMessage?: string }) => {
      const updateData: any = {
        status: params.accept ? "accepted" : params.counterAmount ? "countered" : "rejected",
        responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (params.counterAmount) {
        updateData.counter_amount = params.counterAmount;
        updateData.counter_message = params.counterMessage;
      }

      const { error } = await supabase
        .from("gear_marketplace_offers")
        .update(updateData)
        .eq("id", params.offerId);

      if (error) throw error;
    },
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ["gear-marketplace-received-offers"] });
      toast.success(params.accept ? "Offer accepted!" : "Response sent");
    },
    onError: (error: any) => {
      toast.error("Failed to respond to offer", { description: error.message });
    },
  });

  // Calculate suggested price based on condition
  const calculateSuggestedPrice = (basePrice: number, condition: number, rarity: string) => {
    const conditionMultiplier = 0.30 + (condition * 0.007);
    const rarityMultipliers: Record<string, number> = {
      legendary: 1.2,
      epic: 1.1,
      rare: 1.0,
      uncommon: 0.95,
      common: 0.9,
    };
    const rarityMultiplier = rarityMultipliers[rarity?.toLowerCase()] || 0.9;
    return Math.round(basePrice * conditionMultiplier * rarityMultiplier);
  };

  return {
    listings,
    myListings,
    myPurchases,
    receivedOffers,
    isLoading: listingsLoading || myListingsLoading || purchasesLoading || offersLoading,
    createListing: createListingMutation.mutate,
    cancelListing: cancelListingMutation.mutate,
    buyGear: buyGearMutation.mutate,
    makeOffer: makeOfferMutation.mutate,
    respondToOffer: respondToOfferMutation.mutate,
    isCreatingListing: createListingMutation.isPending,
    isCancellingListing: cancelListingMutation.isPending,
    isBuying: buyGearMutation.isPending,
    isMakingOffer: makeOfferMutation.isPending,
    calculateSuggestedPrice,
  };
};
