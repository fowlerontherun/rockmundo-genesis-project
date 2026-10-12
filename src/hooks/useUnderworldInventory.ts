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

      const { data: purchase, error: fetchError } = await supabase
        .from("underworld_purchases")
        .select(`*, product:underworld_products(*)`)
        .eq("id", purchaseId)
        .eq("profile_id", profileId)
        .single();

      if (fetchError || !purchase) throw new Error("Item not found in inventory");
      if (purchase.is_used) throw new Error("Item has already been used");
      const stackQuantity = Math.max(0, Number(purchase.quantity ?? 1));
      if (!Number.isInteger(stackQuantity) || stackQuantity < 1) throw new Error("No remaining items in this stack");
      if (purchase.expires_at && Date.parse(purchase.expires_at) <= Date.now()) throw new Error("This purchase has expired");

      const product = purchase.product as UnderworldProduct;
      // Keep the immutable purchase-time reward; catalogue edits must not
      // retroactively change effects of inventory items already paid for.
      const rawEffects = purchase.effects_applied ?? {};
      const effects: EffectsRecord = typeof rawEffects === "object" && rawEffects !== null && !Array.isArray(rawEffects)
        ? rawEffects as EffectsRecord
        : {};

      // Fail before applying any of the other item effects when a skill reward
      // cannot be delivered. Do not consume a paid XP item without its XP.
      let ownedSkillProgress: { id: string; current_xp: number | null } | null = null;
      if (effects.skill_slug && effects.skill_xp) {
        const { data, error } = await supabase.from("skill_progress")
          .select("id, current_xp").eq("profile_id", profileId)
          .eq("skill_slug", String(effects.skill_slug)).maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Unlock this skill before using the XP item.");
        ownedSkillProgress = data;
      }

      if (effects.health || effects.energy || effects.xp || effects.fame || effects.cash) {
        const { data: profile, error: profileFetchError } = await supabase
          .from("profiles")
          .select("health, energy, experience, fame, cash")
          .eq("id", profileId)
          .single();

        if (profileFetchError) throw profileFetchError;

        const updates: Record<string, number> = {};
        if (effects.health) updates.health = Math.max(0, Math.min(100, (profile?.health || 0) + Number(effects.health)));
        if (effects.energy) updates.energy = Math.max(0, Math.min(100, (profile?.energy || 0) + Number(effects.energy)));
        if (effects.xp) updates.experience = (profile?.experience || 0) + Number(effects.xp);
        if (effects.fame) updates.fame = (profile?.fame || 0) + Number(effects.fame);
        if (effects.cash) updates.cash = Math.max(0, (profile?.cash || 0) + Number(effects.cash));

        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase.from("profiles").update(updates as any).eq("id", profileId);
          if (updateError) throw updateError;
        }
      }

      if (ownedSkillProgress && effects.skill_xp) {
        const skillXpToAdd = Number(effects.skill_xp);
        if (!Number.isFinite(skillXpToAdd) || skillXpToAdd <= 0) throw new Error("Invalid item skill reward");
        const { error } = await supabase.from("skill_progress")
          .update({ current_xp: (ownedSkillProgress.current_xp || 0) + skillXpToAdd })
          .eq("id", ownedSkillProgress.id);
        if (error) throw error;
      }

      const { data: consumed, error: markUsedError } = await supabase
        .from("underworld_purchases")
        .update({ quantity: stackQuantity - 1, is_used: stackQuantity === 1 })
        .eq("id", purchaseId)
        .eq("profile_id", profileId)
        .eq("quantity", stackQuantity)
        .eq("is_used", false)
        .select("id").maybeSingle();
      if (markUsedError) throw markUsedError;
      if (!consumed) throw new Error("Item quantity changed while using it. Refresh inventory and try again.");

      let exposure: ExposureResult | null = null;
      if (product?.addiction_type) {
        const intensity = product.category === "consumable" ? 18 : product.category === "booster" ? 12 : 8;
        const { data, error } = await (supabase as any).rpc("record_addiction_exposure", {
          p_profile_id: profileId,
          p_addiction_type: product.addiction_type,
          p_intensity: intensity,
          p_source: "underworld_item",
          p_source_id: product.id,
        });
        if (error) throw error;
        exposure = data as ExposureResult;
      }

      return { success: true, product, exposure };
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
