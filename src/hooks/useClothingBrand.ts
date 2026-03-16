import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";
import type { ClothingScores } from "@/utils/clothingQuality";

export interface ClothingBrand {
  id: string;
  user_id: string;
  brand_name: string;
  brand_description: string | null;
  logo_url: string | null;
  genre_focus: string;
  quality_rating: number;
  style_rating: number;
  reputation: number;
  total_sales: number;
  total_revenue: number;
  city_id: string | null;
  is_open: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClothingItem {
  id: string;
  brand_id: string;
  creator_user_id: string;
  name: string;
  description: string | null;
  category: string;
  genre_style: string;
  quality_score: number;
  style_score: number;
  production_cost: number;
  sale_price: number;
  stock_quantity: number;
  total_sold: number;
  is_listed: boolean;
  rarity: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export const useClothingBrand = () => {
  const { user } = useAuth();
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  const { data: brand, isLoading: brandLoading } = useQuery({
    queryKey: ["clothing-brand", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data, error } = await supabase
        .from("player_clothing_brands" as never)
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as ClothingBrand | null;
    },
    enabled: !!profileId,
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["clothing-items", brand?.id],
    queryFn: async () => {
      if (!brand) return [];
      const { data, error } = await supabase
        .from("player_clothing_items" as never)
        .select("*")
        .eq("brand_id", brand.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClothingItem[];
    },
    enabled: !!brand,
  });

  const createBrand = useMutation({
    mutationFn: async (input: { brand_name: string; brand_description?: string; genre_focus: string; city_id?: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("player_clothing_brands" as never)
        .insert({ ...input, user_id: user.id } as never)
        .select()
        .single();
      if (error) throw error;
      return data as ClothingBrand;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clothing-brand"] });
      toast.success("Brand created!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createItem = useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      category: string;
      genre_style: string;
      sale_price: number;
      stock_quantity: number;
      scores: ClothingScores;
    }) => {
      if (!user || !brand) throw new Error("Brand required");
      const { scores, ...rest } = input;
      const { data, error } = await supabase
        .from("player_clothing_items" as never)
        .insert({
          ...rest,
          brand_id: brand.id,
          creator_user_id: user.id,
          quality_score: scores.qualityScore,
          style_score: scores.styleScore,
          rarity: scores.rarity,
          production_cost: scores.productionCost,
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data as ClothingItem;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["clothing-items"] });
      // Award XP for item creation based on quality
      const xp = Math.floor(30 + (variables.scores.qualityScore / 100) * 50);
      toast.success(`Item created! +${xp} XP`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateItem = useMutation({
    mutationFn: async (input: { id: string; sale_price?: number; is_listed?: boolean; stock_quantity?: number }) => {
      const { id, ...updates } = input;
      const { error } = await supabase
        .from("player_clothing_items" as never)
        .update(updates as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clothing-items"] });
      toast.success("Item updated!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    brand,
    items,
    loading: brandLoading || itemsLoading,
    createBrand,
    createItem,
    updateItem,
  };
};
