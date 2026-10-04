import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";

export interface LuthieryShopCity {
  id: string;
  name: string;
  country: string;
}

export interface LuthieryShop {
  id: string;
  owner_profile_id: string;
  name: string;
  brand_tagline: string | null;
  brand_colour: string;
  brand_logo_url: string | null;
  city_id: string;
  commission_rate: number;
  reputation: number;
  completed_sales: number;
  cancelled_listings: number;
  gross_sales: number;
  is_open: boolean;
  updated_at?: string;
  city?: LuthieryShopCity | null;
}

export interface LuthieryShopListing {
  id: string;
  shop_id: string;
  seller_profile_id: string;
  player_equipment_id: string;
  equipment_id: string;
  craft_id: string;
  maker_profile_id: string;
  maker_name: string;
  instrument_name: string;
  instrument_kind: "electric_guitar" | "electric_bass";
  rarity: string;
  final_quality: number;
  condition_at_listing: number;
  asking_price: number;
  material_cost_basis: number;
  suggested_value: number;
  description: string | null;
  provenance_snapshot: Record<string, any>;
  stat_snapshot: Record<string, number>;
  status: "active" | "processing" | "sold" | "cancelled";
  final_sale_price: number | null;
  listed_at: string;
  sold_at: string | null;
  shop?: LuthieryShop | null;
}

export interface LuthieryShopSale {
  id: string;
  listing_id: string;
  equipment_id: string;
  seller_profile_id: string;
  buyer_profile_id: string;
  maker_profile_id: string;
  maker_name: string;
  sale_price: number;
  commission_rate: number;
  maker_commission: number;
  seller_received: number;
  quality_score: number;
  value_score: number;
  reliability_score: number;
  reputation_after: number;
  sold_at: string;
}

export interface OwnedCraftedInstrument {
  id: string;
  equipment_id: string;
  condition: number;
  is_equipped: boolean;
  equipped: boolean;
  equipment: {
    id: string;
    name: string;
    custom_name: string | null;
    rarity: string | null;
    stat_boosts: Record<string, number> | null;
    is_crafted: boolean;
    subcategory: string | null;
    crafted_by_profile_id: string | null;
  };
}

interface ShopProfile {
  id: string;
  username: string;
  display_name: string | null;
  cash: number;
  current_city_id: string | null;
  city?: LuthieryShopCity | null;
}

const LUTHIERY_SKILLS = [
  "luthiery_basic_technical",
  "luthiery_professional_technical",
  "luthiery_mastery_technical",
];

const friendlyShopError = (error: any) => {
  const message = String(error?.message ?? error ?? "");
  if (message.includes("luthiery_shop_professional_required")) {
    return "Reach Basic Luthiery level 20 to open an instrument shop.";
  }
  if (message.includes("luthiery_shop_city_required")) {
    return "Travel to a city before opening or relocating your shop.";
  }
  if (message.includes("luthiery_shop_insufficient_funds") || message.includes("insufficient funds")) {
    return "You do not have enough cash for this instrument.";
  }
  if (message.includes("luthiery_shop_instrument_equipped")) {
    return "Unequip this instrument before listing it.";
  }
  if (message.includes("luthiery_shop_instrument_already_listed")) {
    return "This instrument is already listed.";
  }
  if (message.includes("luthiery_shop_listed_instrument_locked")) {
    return "This instrument is locked while its shop listing is active.";
  }
  if (message.includes("luthiery_shop_cannot_buy_own_listing")) {
    return "You cannot buy your own listing.";
  }
  if (message.includes("luthiery_shop_listing_not_active")) {
    return "That listing is no longer available.";
  }
  return message || "The instrument shop request failed.";
};

export const useLuthieryShops = () => {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  const { data: profile = null, isLoading: profileLoading } = useQuery({
    queryKey: ["luthiery-shop-profile", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("id, username, display_name, cash, current_city_id, city:cities!profiles_current_city_id_fkey(id,name,country)")
        .eq("id", profileId)
        .single();
      if (error) throw error;
      return data as ShopProfile;
    },
    enabled: !!profileId,
  });

  const { data: skillProgress = [], isLoading: skillsLoading } = useQuery({
    queryKey: ["luthiery-shop-skills", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await (supabase as any)
        .from("skill_progress")
        .select("skill_slug,current_level")
        .eq("profile_id", profileId)
        .in("skill_slug", LUTHIERY_SKILLS);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profileId,
  });

  const { data: shops = [], isLoading: shopsLoading } = useQuery({
    queryKey: ["luthiery-shops"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("luthiery_shops")
        .select("*, city:cities!luthiery_shops_city_id_fkey(id,name,country)")
        .eq("is_open", true)
        .order("reputation", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LuthieryShop[];
    },
  });

  const { data: listings = [], isLoading: listingsLoading } = useQuery({
    queryKey: ["luthiery-shop-listings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("luthiery_shop_listings")
        .select("*, shop:luthiery_shops!luthiery_shop_listings_shop_id_fkey(*, city:cities!luthiery_shops_city_id_fkey(id,name,country))")
        .eq("status", "active")
        .order("listed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LuthieryShopListing[];
    },
  });

  const { data: myShop = null, isLoading: myShopLoading } = useQuery({
    queryKey: ["luthiery-shop-mine", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data, error } = await (supabase as any)
        .from("luthiery_shops")
        .select("*, city:cities!luthiery_shops_city_id_fkey(id,name,country)")
        .eq("owner_profile_id", profileId)
        .maybeSingle();
      if (error) throw error;
      return data as LuthieryShop | null;
    },
    enabled: !!profileId,
  });

  const { data: myListings = [], isLoading: myListingsLoading } = useQuery({
    queryKey: ["luthiery-shop-my-listings", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await (supabase as any)
        .from("luthiery_shop_listings")
        .select("*")
        .eq("seller_profile_id", profileId)
        .order("listed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LuthieryShopListing[];
    },
    enabled: !!profileId,
  });

  const { data: salesHistory = [], isLoading: salesLoading } = useQuery({
    queryKey: ["luthiery-shop-sales", myShop?.id],
    queryFn: async () => {
      if (!myShop?.id) return [];
      const { data, error } = await (supabase as any)
        .from("luthiery_shop_sales")
        .select("*")
        .eq("shop_id", myShop.id)
        .order("sold_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LuthieryShopSale[];
    },
    enabled: !!myShop?.id,
  });

  const { data: ownedInstruments = [], isLoading: inventoryLoading } = useQuery({
    queryKey: ["luthiery-shop-owned-instruments", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await (supabase as any)
        .from("player_equipment")
        .select("id,equipment_id,condition,is_equipped,equipped,equipment:equipment_items!equipment_id(id,name,custom_name,rarity,stat_boosts,is_crafted,subcategory,crafted_by_profile_id)")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).filter((row: any) =>
        row.equipment?.is_crafted === true &&
        row.equipment?.subcategory === "custom_luthiery"
      ) as OwnedCraftedInstrument[];
    },
    enabled: !!profileId,
  });

  const activeListingEquipmentIds = useMemo(
    () => new Set(
      myListings
        .filter((listing) => listing.status === "active" || listing.status === "processing")
        .map((listing) => listing.player_equipment_id)
    ),
    [myListings]
  );

  const availableInstruments = useMemo(
    () => ownedInstruments.filter((instrument) =>
      !instrument.is_equipped &&
      !instrument.equipped &&
      !activeListingEquipmentIds.has(instrument.id)
    ),
    [activeListingEquipmentIds, ownedInstruments]
  );

  const levels = useMemo(() => {
    const map = new Map(skillProgress.map((entry: any) => [entry.skill_slug, Number(entry.current_level ?? 0)]));
    return {
      basic: map.get("luthiery_basic_technical") ?? 0,
      professional: map.get("luthiery_professional_technical") ?? 0,
      mastery: map.get("luthiery_mastery_technical") ?? 0,
    };
  }, [skillProgress]);

  const isQualified = levels.basic >= 20 || levels.professional >= 1 || levels.mastery >= 1;

  const invalidateShopData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["luthiery-shops"] }),
      queryClient.invalidateQueries({ queryKey: ["luthiery-shop-listings"] }),
      queryClient.invalidateQueries({ queryKey: ["luthiery-shop-mine", profileId] }),
      queryClient.invalidateQueries({ queryKey: ["luthiery-shop-my-listings", profileId] }),
      queryClient.invalidateQueries({ queryKey: ["luthiery-shop-sales"] }),
      queryClient.invalidateQueries({ queryKey: ["luthiery-shop-owned-instruments", profileId] }),
      queryClient.invalidateQueries({ queryKey: ["player-equipment", profileId] }),
      queryClient.invalidateQueries({ queryKey: ["active-profile"] }),
      queryClient.invalidateQueries({ queryKey: ["luthiery-shop-profile", profileId] }),
    ]);
  };

  const openShopMutation = useMutation({
    mutationFn: async (input: {
      name: string;
      brandTagline?: string;
      brandColour: string;
      brandLogoUrl?: string;
      commissionRate: number;
    }) => {
      if (!profileId) throw new Error("No active character selected");
      const { data, error } = await (supabase as any).rpc("open_luthiery_shop", {
        p_profile_id: profileId,
        p_name: input.name,
        p_brand_tagline: input.brandTagline || null,
        p_brand_colour: input.brandColour,
        p_brand_logo_url: input.brandLogoUrl || null,
        p_commission_rate: input.commissionRate,
      });
      if (error) throw new Error(friendlyShopError(error));
      return data;
    },
    onSuccess: async () => {
      await invalidateShopData();
      toast.success("Instrument shop opened!");
    },
    onError: (error: any) => toast.error(friendlyShopError(error)),
  });

  const updateShopMutation = useMutation({
    mutationFn: async (input: {
      name: string;
      brandTagline?: string;
      brandColour: string;
      brandLogoUrl?: string;
      commissionRate: number;
      isOpen: boolean;
      moveToCurrentCity?: boolean;
    }) => {
      if (!profileId) throw new Error("No active character selected");
      const { data, error } = await (supabase as any).rpc("update_luthiery_shop", {
        p_profile_id: profileId,
        p_name: input.name,
        p_brand_tagline: input.brandTagline || null,
        p_brand_colour: input.brandColour,
        p_brand_logo_url: input.brandLogoUrl || null,
        p_commission_rate: input.commissionRate,
        p_is_open: input.isOpen,
        p_move_to_current_city: Boolean(input.moveToCurrentCity),
      });
      if (error) throw new Error(friendlyShopError(error));
      return data;
    },
    onSuccess: async () => {
      await invalidateShopData();
      toast.success("Shop updated.");
    },
    onError: (error: any) => toast.error(friendlyShopError(error)),
  });

  const createListingMutation = useMutation({
    mutationFn: async (input: { playerEquipmentId: string; askingPrice: number; description?: string }) => {
      if (!profileId) throw new Error("No active character selected");
      const { data, error } = await (supabase as any).rpc("create_luthiery_shop_listing", {
        p_profile_id: profileId,
        p_player_equipment_id: input.playerEquipmentId,
        p_asking_price: Math.round(input.askingPrice),
        p_description: input.description || null,
      });
      if (error) throw new Error(friendlyShopError(error));
      return data;
    },
    onSuccess: async () => {
      await invalidateShopData();
      toast.success("Instrument listed for sale.");
    },
    onError: (error: any) => toast.error(friendlyShopError(error)),
  });

  const cancelListingMutation = useMutation({
    mutationFn: async (listingId: string) => {
      if (!profileId) throw new Error("No active character selected");
      const { data, error } = await (supabase as any).rpc("cancel_luthiery_shop_listing", {
        p_profile_id: profileId,
        p_listing_id: listingId,
      });
      if (error) throw new Error(friendlyShopError(error));
      return data;
    },
    onSuccess: async () => {
      await invalidateShopData();
      toast.success("Listing cancelled.");
    },
    onError: (error: any) => toast.error(friendlyShopError(error)),
  });

  const purchaseListingMutation = useMutation({
    mutationFn: async (listingId: string) => {
      if (!profileId) throw new Error("No active character selected");
      const { data, error } = await (supabase as any).rpc("purchase_luthiery_shop_listing", {
        p_profile_id: profileId,
        p_listing_id: listingId,
      });
      if (error) throw new Error(friendlyShopError(error));
      return data;
    },
    onSuccess: async (result: any) => {
      await invalidateShopData();
      if (result?.status === "already_completed") {
        toast.success("This instrument is already in your inventory.");
      } else {
        toast.success("Instrument purchased!");
      }
    },
    onError: (error: any) => toast.error(friendlyShopError(error)),
  });

  return {
    profile,
    levels,
    isQualified,
    shops,
    listings,
    myShop,
    myListings,
    salesHistory,
    ownedInstruments,
    availableInstruments,
    isLoading:
      profileLoading ||
      skillsLoading ||
      shopsLoading ||
      listingsLoading ||
      myShopLoading ||
      myListingsLoading ||
      salesLoading ||
      inventoryLoading,
    openShop: openShopMutation.mutateAsync,
    updateShop: updateShopMutation.mutateAsync,
    createListing: createListingMutation.mutateAsync,
    cancelListing: cancelListingMutation.mutateAsync,
    purchaseListing: purchaseListingMutation.mutateAsync,
    isOpeningShop: openShopMutation.isPending,
    isUpdatingShop: updateShopMutation.isPending,
    isCreatingListing: createListingMutation.isPending,
    isCancellingListing: cancelListingMutation.isPending,
    isPurchasing: purchaseListingMutation.isPending,
  };
};
