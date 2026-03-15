import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";
import type { ClothingItem, ClothingBrand } from "./useClothingBrand";

export interface MarketplaceItem extends ClothingItem {
  brand?: ClothingBrand;
}

export const useClothingMarketplace = (filters?: {
  category?: string;
  genre?: string;
  search?: string;
}) => {
  const { user } = useAuth();
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["clothing-marketplace", filters],
    queryFn: async () => {
      let query = supabase
        .from("player_clothing_items" as never)
        .select("*, player_clothing_brands!inner(*)")
        .eq("is_listed", true)
        .gt("stock_quantity", 0)
        .order("created_at", { ascending: false });

      if (filters?.category) {
        query = query.eq("category", filters.category);
      }
      if (filters?.genre) {
        query = query.eq("genre_style", filters.genre);
      }
      if (filters?.search) {
        query = query.ilike("name", `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((item: Record<string, unknown>) => ({
        ...item,
        brand: item.player_clothing_brands as unknown as ClothingBrand,
      })) as MarketplaceItem[];
    },
    enabled: !!user,
  });

  const purchaseItem = useMutation({
    mutationFn: async (item: MarketplaceItem) => {
      if (!user) throw new Error("Not authenticated");

      // Get buyer's cash
      const { data: profile } = await supabase
        .from("profiles")
        .select("cash")
        .eq("user_id", user.id)
        .single();

      if (!profile || (profile.cash ?? 0) < item.sale_price) {
        throw new Error("Insufficient funds");
      }

      // Deduct cash from buyer
      const { error: cashError } = await supabase
        .from("profiles")
        .update({ cash: (profile.cash ?? 0) - item.sale_price } as never)
        .eq("user_id", user.id);
      if (cashError) throw cashError;

      // Add cash to seller
      const { data: sellerProfile } = await supabase
        .from("profiles")
        .select("cash")
        .eq("user_id", item.creator_user_id)
        .single();

      if (sellerProfile) {
        await supabase
          .from("profiles")
          .update({ cash: (sellerProfile.cash ?? 0) + item.sale_price } as never)
          .eq("user_id", item.creator_user_id);
      }

      // Decrement stock
      await supabase
        .from("player_clothing_items" as never)
        .update({
          stock_quantity: Math.max(0, item.stock_quantity - 1),
          total_sold: item.total_sold + 1,
        } as never)
        .eq("id", item.id);

      // Update brand stats
      await supabase
        .from("player_clothing_brands" as never)
        .update({
          total_sales: (item.brand?.total_sales ?? 0) + 1,
          total_revenue: (item.brand?.total_revenue ?? 0) + item.sale_price,
        } as never)
        .eq("id", item.brand_id);

      // Record purchase
      const { error: purchaseError } = await supabase
        .from("player_clothing_purchases" as never)
        .insert({
          buyer_user_id: user.id,
          item_id: item.id,
          seller_user_id: item.creator_user_id,
          price_paid: item.sale_price,
        } as never);
      if (purchaseError) throw purchaseError;

      return item;
    },
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ["clothing-marketplace"] });
      queryClient.invalidateQueries({ queryKey: ["gameData"] });
      queryClient.invalidateQueries({ queryKey: ["player-purchased-clothing"] });
      toast.success(`Purchased "${item.name}"! Seller earned +10 XP`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { listings, loading: isLoading, purchaseItem };
};
