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

export interface ClothingBonusConfig {
  daily_xp?: number;
  daily_ap?: number;
  performance_pct?: number;
  recording_pct?: number;
  songwriting_pct?: number;
}

export interface ClothingDetailLayer {
  id: string;
  type: "decal" | "graphic" | "text" | "patch" | "embroidery" | "trim" | "studs" | "zip" | "buttons" | "distress" | "stitching" | "badge";
  name: string;
  zone: string;
  color: string;
  secondaryColor?: string;
  text?: string;
  asset?: string;
  scale?: number;
  rotation?: number;
  opacity?: number;
  offsetX?: number;
  offsetY?: number;
}

export interface ClothingItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  wearable_slot?: string | null;
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
  bonus_enabled?: boolean | null;
  bonus_config?: ClothingBonusConfig | null;
  garment_config?: Record<string, any> | null;
  material_config?: Record<string, any> | null;
  pattern_config?: Record<string, any> | null;
  detail_layers?: ClothingDetailLayer[] | null;
  fit_config?: Record<string, any> | null;
  wear_config?: Record<string, any> | null;
  customization_zones?: Array<{ id: string; name: string; color?: string; playerEditable?: boolean; player_editable?: boolean }> | null;
  render_config?: Record<string, any> | null;
  variant_matrix?: Array<{ id?: string; key?: string; name: string; label?: string; primaryColor?: string; secondaryColor?: string; pattern?: string; material?: string }> | null;
  external_key?: string | null;
  schema_version?: number | null;
  import_source?: string | null;
  import_batch_id?: string | null;
  preview_status?: 'pending' | 'ready' | 'failed' | null;
  preview_manifest?: Record<string, any> | null;
  preview_generated_at?: string | null;
  last_preview_error?: string | null;
  shape_config?: Record<string, any> | null;
}

export interface OwnedSkin {
  item_id: string;
  item_type: string;
  is_equipped: boolean | null;
  selected_variant_key?: string | null;
  customization_config?: Record<string, string> | null;
}

export const useSkinCollections = () => useQuery({
  queryKey: ["skin-collections"],
  queryFn: async () => {
    const { data, error } = await supabase.from("skin_collections").select("*").eq("is_active", true).order("sort_order", { ascending: true });
    if (error) throw error;
    return data as SkinCollection[];
  },
  staleTime: 5 * 60 * 1000,
});

export const useClothingItems = (collectionId?: string) => useQuery({
  queryKey: ["clothing-items", collectionId],
  queryFn: async () => {
    let query = supabase.from("avatar_clothing_items").select("*");
    if (collectionId) query = query.eq("collection_id", collectionId);
    const { data, error } = await query.order("category").order("name");
    if (error) throw error;
    return data as ClothingItem[];
  },
  staleTime: 5 * 60 * 1000,
});

export const useFeaturedItems = () => useQuery({
  queryKey: ["featured-items"],
  queryFn: async () => {
    const { data, error } = await supabase.from("avatar_clothing_items").select("*").eq("featured", true).order("created_at", { ascending: false }).limit(10);
    if (error) throw error;
    return data as ClothingItem[];
  },
  staleTime: 5 * 60 * 1000,
});

export const useNewArrivals = () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return useQuery({
    queryKey: ["new-arrivals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("avatar_clothing_items").select("*").gte("release_date", thirtyDaysAgo.toISOString().split("T")[0]).order("release_date", { ascending: false }).limit(12);
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
      if (!profileId) return [] as OwnedSkin[];
      const { data, error } = await (supabase.from("player_owned_skins") as any)
        .select("item_id, item_type, is_equipped, selected_variant_key, customization_config")
        .eq("profile_id", profileId);
      if (error) throw error;
      return (data || []) as OwnedSkin[];
    },
    enabled: !!profileId,
    staleTime: 2 * 60 * 1000,
  });
};

export const usePurchaseSkin = () => {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId }: { itemId: string; itemType?: string; price: number }) => {
      if (!profileId) throw new Error("Not authenticated");
      const { data: existing } = await supabase.from("player_owned_skins").select("id").eq("profile_id", profileId).eq("item_id", itemId).maybeSingle();
      if (existing) throw new Error("You already own this item");
      const { error: insertError } = await (supabase.from("player_owned_skins") as any).insert({ profile_id: profileId, item_id: itemId, item_type: 'clothing' });
      if (insertError) throw insertError;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owned-skins"] });
      toast.success("Item purchased successfully!");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to purchase item"),
  });
};

export const useSaveClothingCustomization = () => {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      itemId,
      variantKey,
      zoneColours,
      equipped = null,
    }: {
      itemId: string;
      variantKey?: string | null;
      zoneColours?: Record<string, string>;
      equipped?: boolean | null;
    }) => {
      if (!profileId) throw new Error('No active character');
      const { data, error } = await supabase.rpc('set_owned_clothing_customization' as any, {
        p_profile_id: profileId,
        p_item_id: itemId,
        p_variant_key: variantKey || null,
        p_zone_colors: zoneColours || {},
        p_equipped: equipped,
      } as any);
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['owned-skins', profileId] });
      queryClient.invalidateQueries({ queryKey: ['player-owned-skins', profileId] });
      queryClient.invalidateQueries({ queryKey: ['equipped-clothing', profileId] });
      toast.success(
        variables.equipped === true
          ? 'Clothing saved and equipped'
          : variables.equipped === false
            ? 'Clothing saved and unequipped'
            : 'Clothing customisation saved',
      );
    },
    onError: (error: Error) => toast.error(error.message || 'Could not save clothing customisation'),
  });
};
