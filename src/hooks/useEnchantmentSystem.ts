import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";

export interface Enchantment {
  id: string;
  name: string;
  category: string;
  tier: number;
  stat_modifier: Record<string, number>;
  description: string | null;
  rarity: string;
  material_cost: { material_id: string; quantity: number }[];
  cash_cost: number;
  required_skill_slug: string | null;
  min_skill_level: number;
  max_stacks: number;
  incompatible_with: string[];
  icon: string | null;
}

export interface EquipmentEnchantment {
  id: string;
  player_equipment_id: string;
  enchantment_id: string;
  profile_id: string;
  applied_at: string;
  stack_count: number;
  enchantment?: Enchantment;
}

export const useEnchantmentSystem = () => {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  const { data: catalog = [], isLoading: catalogLoading } = useQuery({
    queryKey: ["enchantment-catalog"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("enchantment_catalog")
        .select("*")
        .order("category")
        .order("tier");
      if (error) throw error;
      return data as Enchantment[];
    },
  });

  const { data: appliedEnchantments = [], isLoading: appliedLoading } = useQuery({
    queryKey: ["equipment-enchantments", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await (supabase as any)
        .from("equipment_enchantments")
        .select("*, enchantment:enchantment_catalog(*)")
        .eq("profile_id", profileId);
      if (error) throw error;
      return data as EquipmentEnchantment[];
    },
    enabled: !!profileId,
  });

  const applyEnchantment = useMutation({
    mutationFn: async ({
      playerEquipmentId,
      enchantmentId,
    }: {
      playerEquipmentId: string;
      enchantmentId: string;
    }) => {
      if (!profileId) throw new Error("Not authenticated");

      const enchantment = catalog.find((e) => e.id === enchantmentId);
      if (!enchantment) throw new Error("Enchantment not found");

      // Check existing enchantments on this equipment
      const existing = appliedEnchantments.filter(
        (ae) =>
          ae.player_equipment_id === playerEquipmentId &&
          ae.enchantment_id === enchantmentId
      );
      const currentStacks = existing.reduce((sum, e) => sum + e.stack_count, 0);
      if (currentStacks >= enchantment.max_stacks) {
        throw new Error(`Max stacks (${enchantment.max_stacks}) reached for this enchantment`);
      }

      // Check incompatibilities
      const equippedEnchantmentIds = appliedEnchantments
        .filter((ae) => ae.player_equipment_id === playerEquipmentId)
        .map((ae) => ae.enchantment_id);
      const incompatible = enchantment.incompatible_with || [];
      const conflict = incompatible.find((id) => equippedEnchantmentIds.includes(id));
      if (conflict) {
        const conflictName = catalog.find((c) => c.id === conflict)?.name || "another enchantment";
        throw new Error(`Incompatible with ${conflictName}`);
      }

      // Check cash
      if (enchantment.cash_cost > 0) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("cash")
          .eq("id", profileId)
          .single();
        if (!profile || profile.cash < enchantment.cash_cost) {
          throw new Error(`Insufficient funds (need $${enchantment.cash_cost})`);
        }
        await supabase
          .from("profiles")
          .update({ cash: profile.cash - enchantment.cash_cost })
          .eq("id", profileId);
      }

      // Apply enchantment (upsert stack)
      if (existing.length > 0) {
        const { error } = await (supabase as any)
          .from("equipment_enchantments")
          .update({ stack_count: currentStacks + 1 })
          .eq("id", existing[0].id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("equipment_enchantments")
          .insert({
            player_equipment_id: playerEquipmentId,
            enchantment_id: enchantmentId,
            profile_id: profileId,
            stack_count: 1,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment-enchantments", profileId] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Enchantment applied!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const removeEnchantment = useMutation({
    mutationFn: async (equipmentEnchantmentId: string) => {
      if (!profileId) throw new Error("Not authenticated");
      const { error } = await (supabase as any)
        .from("equipment_enchantments")
        .delete()
        .eq("id", equipmentEnchantmentId)
        .eq("profile_id", profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment-enchantments", profileId] });
      toast.success("Enchantment removed");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const getEnchantmentsForEquipment = (playerEquipmentId: string) =>
    appliedEnchantments.filter((ae) => ae.player_equipment_id === playerEquipmentId);

  return {
    catalog,
    appliedEnchantments,
    isLoading: catalogLoading || appliedLoading,
    applyEnchantment: applyEnchantment.mutate,
    isApplying: applyEnchantment.isPending,
    removeEnchantment: removeEnchantment.mutate,
    isRemoving: removeEnchantment.isPending,
    getEnchantmentsForEquipment,
  };
};
