import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";

export interface SkinCollection {
  id: string;
  name: string;
  description: string | null;
  theme: string | null;
  banner_image_url: string | null;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface ClothingItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number | null;
  is_premium: boolean | null;
  rarity: string | null;
  color_variants: any;
  collection_id: string | null;
  release_date: string | null;
  expiry_date: string | null;
  is_limited_edition: boolean | null;
  featured: boolean | null;
  rpm_asset_id: string | null;
}

export const useSkinCollections = () => {
  return useQuery({
    queryKey: ["skin-collections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skin_collections")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data as SkinCollection[];
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useClothingItems = (collectionId?: string) => {
  return useQuery({
    queryKey: ["clothing-items", collectionId],
    queryFn: async () => {
      let query = supabase.from("avatar_clothing_items").select("*");

      if (collectionId) {
        query = query.eq("collection_id", collectionId);
      }

      const { data, error } = await query.order("category").order("name");

      if (error) throw error;
      return data as ClothingItem[];
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useFeaturedItems = () => {
  return useQuery({
    queryKey: ["featured-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avatar_clothing_items")
        .select("*")
        .eq("featured", true)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as ClothingItem[];
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useNewArrivals = () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return useQuery({
    queryKey: ["new-arrivals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avatar_clothing_items")
        .select("*")
        .gte("release_date", thirtyDaysAgo.toISOString().split("T")[0])
        .order("release_date", { ascending: false })
        .limit(12);

      if (error) throw error;
      return data as ClothingItem[];
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useOwnedSkins = () => {
  const { profileId } = useActiveProfile();

  return useQuery({
    queryKey: ["owned-skins", profileId],
    queryFn: async () => {
      if (!profileId) return [];

      const { data, error } = await supabase
        .from("player_owned_skins")
        .select("item_id, item_type")
        .eq("profile_id", profileId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!profileId,
    staleTime: 2 * 60 * 1000,
  });
};

export const usePurchaseSkin = () => {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      itemType,
    }: {
      itemId: string;
      itemType: string;
      price: number;
    }) => {
      if (!profileId) throw new Error("Not authenticated");

      // Check if already owned
      const { data: existing } = await supabase
        .from("player_owned_skins")
        .select("id")
        .eq("profile_id", profileId)
        .eq("item_id", itemId)
        .maybeSingle();

      if (existing) throw new Error("You already own this item");

      // Add skin to owned
      const { error: insertError } = await supabase
        .from("player_owned_skins")
        .insert({
          profile_id: profileId,
          item_id: itemId,
          item_type: itemType,
        });

      if (insertError) throw insertError;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owned-skins"] });
      toast.success("Item purchased successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to purchase item");
    },
  });
};
