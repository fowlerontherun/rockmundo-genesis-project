import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";

export type ItemType = "gear" | "book" | "underworld" | "clothing";

export interface MarketListing {
  id: string;
  seller_user_id: string;
  seller_profile_id: string;
  item_type: ItemType;
  item_id: string;
  item_name: string;
  item_description: string | null;
  item_category: string | null;
  item_rarity: string | null;
  item_image_url: string | null;
  item_metadata: Record<string, any>;
  asking_price: number;
  is_negotiable: boolean;
  status: string;
  buyer_user_id: string | null;
  listed_at: string;
  expires_at: string;
  views: number;
  seller_name?: string;
}

export interface MarketOffer {
  id: string;
  listing_id: string;
  buyer_user_id: string;
  buyer_profile_id: string;
  offer_amount: number;
  message: string | null;
  status: string;
  created_at: string;
  responded_at: string | null;
  buyer_name?: string;
  listing?: MarketListing;
}

export interface MarketTransaction {
  id: string;
  item_type: string;
  item_name: string;
  sale_price: number;
  marketplace_fee: number;
  seller_proceeds: number;
  completed_at: string;
  seller_user_id: string;
  buyer_user_id: string;
}

const MARKETPLACE_FEE_PCT = 0.05;

export function useItemMarket() {
  const { session } = useAuth();
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  // Browse active listings
  const listings = useQuery({
    queryKey: ["item-market-listings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("item_market_listings")
        .select("*")
        .eq("status", "active")
        .order("listed_at", { ascending: false });
      if (error) throw error;

      // Fetch seller names
      const sellerIds = [...new Set((data || []).map((d: any) => d.seller_profile_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, artist_name")
        .in("id", sellerIds);
      const nameMap = new Map(
        (profiles || []).map((p) => [p.id, p.artist_name || p.display_name || "Unknown"])
      );

      return (data || []).map((d: any) => ({
        ...d,
        seller_name: nameMap.get(d.seller_profile_id) || "Unknown",
      })) as MarketListing[];
    },
    enabled: !!userId,
  });

  // My listings
  const myListings = useQuery({
    queryKey: ["item-market-my-listings", userId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("item_market_listings")
        .select("*")
        .eq("seller_user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MarketListing[];
    },
    enabled: !!userId,
  });

  // My offers (as buyer)
  const myOffers = useQuery({
    queryKey: ["item-market-my-offers", userId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("item_market_offers")
        .select("*")
        .eq("buyer_user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MarketOffer[];
    },
    enabled: !!userId,
  });

  // Offers on my listings (as seller)
  const incomingOffers = useQuery({
    queryKey: ["item-market-incoming-offers", userId],
    queryFn: async () => {
      // Get my listing IDs first
      const { data: myLists } = await (supabase as any)
        .from("item_market_listings")
        .select("id")
        .eq("seller_user_id", userId)
        .eq("status", "active");
      if (!myLists?.length) return [];
      const listingIds = myLists.map((l: any) => l.id);

      const { data, error } = await (supabase as any)
        .from("item_market_offers")
        .select("*")
        .in("listing_id", listingIds)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch buyer names
      const buyerProfileIds = [...new Set((data || []).map((d: any) => d.buyer_profile_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, artist_name")
        .in("id", buyerProfileIds);
      const nameMap = new Map(
        (profiles || []).map((p) => [p.id, p.artist_name || p.display_name || "Unknown"])
      );

      return (data || []).map((d: any) => ({
        ...d,
        buyer_name: nameMap.get(d.buyer_profile_id) || "Unknown",
      })) as MarketOffer[];
    },
    enabled: !!userId,
  });

  // Transaction history
  const transactions = useQuery({
    queryKey: ["item-market-transactions", userId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("item_market_transactions")
        .select("*")
        .order("completed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as MarketTransaction[];
    },
    enabled: !!userId,
  });

  // Create listing
  const createListing = useMutation({
    mutationFn: async (input: {
      itemType: ItemType;
      itemId: string;
      itemName: string;
      itemDescription?: string;
      itemCategory?: string;
      itemRarity?: string;
      itemImageUrl?: string;
      itemMetadata?: Record<string, any>;
      askingPrice: number;
      isNegotiable: boolean;
    }) => {
      const { error } = await (supabase as any)
        .from("item_market_listings")
        .insert({
          seller_user_id: userId,
          seller_profile_id: profileId,
          item_type: input.itemType,
          item_id: input.itemId,
          item_name: input.itemName,
          item_description: input.itemDescription || null,
          item_category: input.itemCategory || null,
          item_rarity: input.itemRarity || null,
          item_image_url: input.itemImageUrl || null,
          item_metadata: input.itemMetadata || {},
          asking_price: input.askingPrice,
          is_negotiable: input.isNegotiable,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-market"] });
      queryClient.invalidateQueries({ queryKey: ["item-market-my-listings"] });
      toast.success("Item listed on the marketplace!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Cancel listing
  const cancelListing = useMutation({
    mutationFn: async (listingId: string) => {
      const { error } = await (supabase as any)
        .from("item_market_listings")
        .update({ status: "cancelled" })
        .eq("id", listingId)
        .eq("seller_user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-market"] });
      toast.success("Listing cancelled.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Buy now (direct purchase at asking price)
  const buyNow = useMutation({
    mutationFn: async (listing: MarketListing) => {
      // Check balance
      const { data: profile } = await supabase
        .from("profiles")
        .select("cash")
        .eq("id", profileId)
        .single();
      if (!profile || (profile.cash || 0) < listing.asking_price) {
        throw new Error("Insufficient funds");
      }

      const fee = Math.floor(listing.asking_price * MARKETPLACE_FEE_PCT);
      const proceeds = listing.asking_price - fee;

      // Deduct buyer cash
      await supabase
        .from("profiles")
        .update({ cash: (profile.cash || 0) - listing.asking_price })
        .eq("id", profileId);

      // Credit seller
      const { data: sellerProfile } = await supabase
        .from("profiles")
        .select("cash")
        .eq("id", listing.seller_profile_id)
        .single();
      if (sellerProfile) {
        await supabase
          .from("profiles")
          .update({ cash: (sellerProfile.cash || 0) + proceeds })
          .eq("id", listing.seller_profile_id);
      }

      // Update listing
      await (supabase as any)
        .from("item_market_listings")
        .update({
          status: "sold",
          buyer_user_id: userId,
          buyer_profile_id: profileId,
          sold_at: new Date().toISOString(),
          sold_price: listing.asking_price,
        })
        .eq("id", listing.id);

      // Record transaction
      await (supabase as any)
        .from("item_market_transactions")
        .insert({
          listing_id: listing.id,
          seller_user_id: listing.seller_user_id,
          buyer_user_id: userId,
          seller_profile_id: listing.seller_profile_id,
          buyer_profile_id: profileId,
          item_type: listing.item_type,
          item_name: listing.item_name,
          sale_price: listing.asking_price,
          marketplace_fee: fee,
          seller_proceeds: proceeds,
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-market"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Item purchased!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Make offer
  const makeOffer = useMutation({
    mutationFn: async (input: { listingId: string; amount: number; message?: string }) => {
      const { error } = await (supabase as any)
        .from("item_market_offers")
        .insert({
          listing_id: input.listingId,
          buyer_user_id: userId,
          buyer_profile_id: profileId,
          offer_amount: input.amount,
          message: input.message || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-market"] });
      toast.success("Offer sent!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Accept offer (seller)
  const acceptOffer = useMutation({
    mutationFn: async (offer: MarketOffer) => {
      // Get listing
      const { data: listing } = await (supabase as any)
        .from("item_market_listings")
        .select("*")
        .eq("id", offer.listing_id)
        .single();
      if (!listing) throw new Error("Listing not found");

      // Check buyer balance
      const { data: buyerProfile } = await supabase
        .from("profiles")
        .select("cash")
        .eq("id", offer.buyer_profile_id)
        .single();
      if (!buyerProfile || (buyerProfile.cash || 0) < offer.offer_amount) {
        throw new Error("Buyer has insufficient funds");
      }

      const fee = Math.floor(offer.offer_amount * MARKETPLACE_FEE_PCT);
      const proceeds = offer.offer_amount - fee;

      // Deduct buyer
      await supabase
        .from("profiles")
        .update({ cash: (buyerProfile.cash || 0) - offer.offer_amount })
        .eq("id", offer.buyer_profile_id);

      // Credit seller
      const { data: sellerProfile } = await supabase
        .from("profiles")
        .select("cash")
        .eq("id", profileId)
        .single();
      if (sellerProfile) {
        await supabase
          .from("profiles")
          .update({ cash: (sellerProfile.cash || 0) + proceeds })
          .eq("id", profileId);
      }

      // Update offer
      await (supabase as any)
        .from("item_market_offers")
        .update({ status: "accepted", responded_at: new Date().toISOString() })
        .eq("id", offer.id);

      // Update listing
      await (supabase as any)
        .from("item_market_listings")
        .update({
          status: "sold",
          buyer_user_id: offer.buyer_user_id,
          buyer_profile_id: offer.buyer_profile_id,
          sold_at: new Date().toISOString(),
          sold_price: offer.offer_amount,
        })
        .eq("id", offer.listing_id);

      // Record transaction
      await (supabase as any)
        .from("item_market_transactions")
        .insert({
          listing_id: offer.listing_id,
          seller_user_id: userId,
          buyer_user_id: offer.buyer_user_id,
          seller_profile_id: profileId,
          buyer_profile_id: offer.buyer_profile_id,
          item_type: listing.item_type,
          item_name: listing.item_name,
          sale_price: offer.offer_amount,
          marketplace_fee: fee,
          seller_proceeds: proceeds,
        });

      // Reject other pending offers
      await (supabase as any)
        .from("item_market_offers")
        .update({ status: "rejected", responded_at: new Date().toISOString() })
        .eq("listing_id", offer.listing_id)
        .eq("status", "pending")
        .neq("id", offer.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-market"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Offer accepted! Sale complete.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Reject offer
  const rejectOffer = useMutation({
    mutationFn: async (offerId: string) => {
      const { error } = await (supabase as any)
        .from("item_market_offers")
        .update({ status: "rejected", responded_at: new Date().toISOString() })
        .eq("id", offerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-market"] });
      toast.success("Offer rejected.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Fetch sellable items for listing creation
  const sellableItems = useQuery({
    queryKey: ["sellable-items", profileId],
    queryFn: async () => {
      const items: {
        id: string;
        type: ItemType;
        name: string;
        description?: string;
        category?: string;
        rarity?: string;
        suggestedPrice: number;
      }[] = [];

      // Gear
      const { data: gear } = await supabase
        .from("player_equipment")
        .select("id, equipment_id, condition")
        .eq("user_id", userId!)
        .eq("is_equipped", false);
      if (gear?.length) {
        const equipIds = gear.map((g) => g.equipment_id);
        const { data: equipDetails } = await supabase
          .from("equipment_items")
          .select("id, name, category, rarity, price_cash")
          .in("id", equipIds);
        const detailMap = new Map((equipDetails || []).map((e) => [e.id, e]));
        gear.forEach((g) => {
          const d = detailMap.get(g.equipment_id);
          if (d) {
            items.push({
              id: g.id,
              type: "gear",
              name: d.name,
              category: d.category || undefined,
              rarity: d.rarity || undefined,
              suggestedPrice: Math.floor((d.price_cash || 100) * (g.condition || 100) / 100 * 0.7),
            });
          }
        });
      }

      // Books
      const { data: books } = await supabase
        .from("player_book_purchases")
        .select("id, book_id, purchase_price")
        .eq("profile_id", profileId!);
      if (books?.length) {
        const bookIds = books.map((b) => b.book_id).filter(Boolean);
        const { data: bookDetails } = await supabase
          .from("skill_books")
          .select("id, title, category, price")
          .in("id", bookIds);
        const bookMap = new Map((bookDetails || []).map((b) => [b.id, b]));
        books.forEach((b) => {
          const d = b.book_id ? bookMap.get(b.book_id) : null;
          if (d) {
            items.push({
              id: b.id,
              type: "book",
              name: d.title,
              category: d.category || undefined,
              suggestedPrice: Math.floor((d.price || b.purchase_price || 50) * 0.6),
            });
          }
        });
      }

      // Underworld items
      const { data: uwPurchases } = await supabase
        .from("underworld_purchases")
        .select("id, product_id, quantity, is_used")
        .eq("profile_id", profileId!)
        .eq("is_used", false);
      if (uwPurchases?.length) {
        const productIds = uwPurchases.map((p) => p.product_id).filter(Boolean);
        const { data: products } = await supabase
          .from("underworld_products")
          .select("id, name, category, rarity, price_cash")
          .in("id", productIds);
        const prodMap = new Map((products || []).map((p) => [p.id, p]));
        uwPurchases.forEach((p) => {
          const d = p.product_id ? prodMap.get(p.product_id) : null;
          if (d) {
            items.push({
              id: p.id,
              type: "underworld",
              name: d.name,
              category: d.category || undefined,
              rarity: d.rarity || undefined,
              suggestedPrice: Math.floor((d.price_cash || 100) * 0.8),
            });
          }
        });
      }

      // Clothing
      const { data: clothing } = await supabase
        .from("player_clothing_purchases")
        .select("id, item_id, price_paid")
        .eq("buyer_user_id", userId!);
      if (clothing?.length) {
        const clothingItemIds = clothing.map((c) => c.item_id).filter(Boolean);
        const { data: clothingDetails } = await supabase
          .from("player_clothing_items")
          .select("id, name, category, rarity, sale_price")
          .in("id", clothingItemIds);
        const clothMap = new Map((clothingDetails || []).map((c) => [c.id, c]));
        clothing.forEach((c) => {
          const d = c.item_id ? clothMap.get(c.item_id) : null;
          if (d) {
            items.push({
              id: c.id,
              type: "clothing",
              name: d.name,
              category: d.category || undefined,
              rarity: d.rarity || undefined,
              suggestedPrice: Math.floor(Number(d.sale_price || c.price_paid || 50) * 0.6),
            });
          }
        });
      }

      return items;
    },
    enabled: !!userId && !!profileId,
  });

  return {
    listings,
    myListings,
    myOffers,
    incomingOffers,
    transactions,
    sellableItems,
    createListing,
    cancelListing,
    buyNow,
    makeOffer,
    acceptOffer,
    rejectOffer,
    userId,
    profileId,
  };
}
