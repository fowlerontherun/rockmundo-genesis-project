import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useToast } from "@/hooks/use-toast";
import type { UnderworldProduct } from "@/hooks/useUnderworldStore";
import type { Json } from "@/integrations/supabase/types";

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

export const useUnderworldInventory = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch unused inventory items (not used or boosters)
  const { data: inventoryItems = [], isLoading: inventoryLoading } = useQuery({
    queryKey: ["underworld-inventory", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("underworld_purchases")
        .select(`
          *,
          product:underworld_products(*)
        `)
        .eq("user_id", user.id)
        .eq("is_used", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as InventoryItem[];
    },
    enabled: !!user?.id,
  });

  // Use an item from inventory
  const useItem = useMutation({
    mutationFn: async (purchaseId: string) => {
      if (!user?.id) throw new Error("Not logged in");

      // Get the purchase and product details
      const { data: purchase, error: fetchError } = await supabase
        .from("underworld_purchases")
        .select(`*, product:underworld_products(*)`)
        .eq("id", purchaseId)
        .eq("user_id", user.id)
        .single();

      if (fetchError || !purchase) throw new Error("Item not found in inventory");
      if (purchase.is_used) throw new Error("Item has already been used");

      const product = purchase.product as UnderworldProduct;
      const rawEffects = product?.effects || purchase.effects_applied || {};
      const effects: EffectsRecord = (typeof rawEffects === 'object' && rawEffects !== null && !Array.isArray(rawEffects)) 
        ? rawEffects as EffectsRecord 
        : {};

      // Apply instant effects to profile
      if (effects.health || effects.energy || effects.xp || effects.fame) {
        const { data: profile, error: profileFetchError } = await supabase
          .from("profiles")
          .select("health, energy, experience, fame")
          .eq("user_id", user.id)
          .single();

        if (profileFetchError) throw profileFetchError;

        const updates: Record<string, number> = {};
        if (effects.health) {
          updates.health = Math.min(100, (profile?.health || 0) + (effects.health as number));
        }
        if (effects.energy) {
          updates.energy = Math.min(100, (profile?.energy || 0) + (effects.energy as number));
        }
        if (effects.xp) {
          updates.experience = (profile?.experience || 0) + (effects.xp as number);
        }
        if (effects.fame) {
          updates.fame = (profile?.fame || 0) + (effects.fame as number);
        }

        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from("profiles")
            .update(updates)
            .eq("user_id", user.id);

          if (updateError) throw updateError;
        }
      }

      // Apply skill XP if applicable
      if (effects.skill_slug && effects.skill_xp) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (profile?.id) {
          const { data: skillProgress, error: skillFetchError } = await supabase
            .from("skill_progress")
            .select("*")
            .eq("profile_id", profile.id)
            .eq("skill_slug", String(effects.skill_slug))
            .single();

          if (!skillFetchError && skillProgress) {
            const skillXpToAdd = typeof effects.skill_xp === 'number' ? effects.skill_xp : parseInt(String(effects.skill_xp), 10);
            const { error: skillUpdateError } = await supabase
              .from("skill_progress")
              .update({
                current_xp: (skillProgress.current_xp || 0) + skillXpToAdd,
              })
              .eq("id", skillProgress.id);

            if (skillUpdateError) throw skillUpdateError;
          }
        }
      }

      // Mark item as used
      const { error: markUsedError } = await supabase
        .from("underworld_purchases")
        .update({ is_used: true })
        .eq("id", purchaseId);

      if (markUsedError) throw markUsedError;

      return { success: true, product };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["underworld-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-history"] });

      toast({
        title: "Item Used",
        description: `${data.product?.name || "Item"} effects have been applied!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Use Item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    inventoryItems,
    inventoryLoading,
    useItem,
  };
};
