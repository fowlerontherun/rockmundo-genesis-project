import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/hooks/use-toast";
import type { UnderworldProduct } from "@/hooks/useUnderworldStore";
import type { Json } from "@/integrations/supabase/types";
import type { AddictionType } from "@/utils/addictionSystem";

export interface InventoryItem {
  id: string;
  user_id: string;
  product_id: string;
  paid_with: string;
  cash_amount: number | null;
  token_id: string | null;
  token_amount: number | null;
  effects_applied: Json;
  applied_at: string;
  expires_at: string | null;
  is_used: boolean;
  quantity: number;
  created_at: string;
  product?: UnderworldProduct;
}

type EffectsRecord = Record<string, number | string>;

type ExposureResult = {
  ok?: boolean;
  triggered?: boolean;
  relapsed?: boolean;
  addictionType?: AddictionType;
  severity?: number;
  exposure?: number;
};

export const useUnderworldInventory = () => {
  const { profileId } = useActiveProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: inventoryItems = [], isLoading: inventoryLoading } = useQuery({
    queryKey: ["underworld-inventory", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("underworld_purchases")
        .select(`
          *,
          product:underworld_products(*)
        `)
        .eq("profile_id", profileId)
        .eq("is_used", false)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as InventoryItem[];
    },
    enabled: !!profileId,
  });

  const useItem = useMutation({
    mutationFn: async (purchaseId: string) => {
      if (!profileId) throw new Error("Not logged in");

      const { data, error } = await (supabase as any).rpc("consume_underworld_item_atomic", {
        p_profile_id: profileId,
        p_purchase_id: purchaseId,
      });
      if (error) throw error;
      if (!data?.success) throw new Error("Item consumption was not confirmed");
      return {
        success: true,
        product: { name: String(data.productName ?? "Item") },
        exposure: (data.exposure ?? null) as ExposureResult | null,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["underworld-inventory", profileId] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["user-cash-balance", profileId] });
      queryClient.invalidateQueries({ queryKey: ["purchase-history", profileId] });
      queryClient.invalidateQueries({ queryKey: ["active-boosts", profileId] });
      queryClient.invalidateQueries({ queryKey: ["addictions", profileId] });

      const warning = data.exposure?.relapsed
        ? " This exposure has caused a relapse."
        : data.exposure?.triggered
          ? " Repeated exposure has developed into an addiction."
          : "";

      toast({
        title: data.exposure?.triggered || data.exposure?.relapsed ? "Item Used — Health Risk" : "Item Used",
        description: `${data.product?.name || "Item"} effects have been applied.${warning}`,
        variant: data.exposure?.triggered || data.exposure?.relapsed ? "destructive" : "default",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to Use Item", description: error.message, variant: "destructive" });
    },
  });

  return { inventoryItems, inventoryLoading, useItem };
};
