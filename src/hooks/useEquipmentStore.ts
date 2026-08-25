import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";
import { purchaseEquipmentAtomic } from "@/services/equipment/equipmentPurchaseService";

export interface EquipmentItem {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  brand: string | null;
  description: string | null;
  base_price: number;
  quality_rating: number;
  durability: number;
  stat_boosts: any;
  rarity: string;
  required_level: number;
  image_url: string | null;
  is_available: boolean;
}

export interface PlayerEquipment {
  id: string;
  profile_id: string;
  equipment_id: string;
  condition: number;
  purchased_at: string;
  last_maintained: string | null;
  maintenance_cost: number;
  is_equipped: boolean;
  equipment: EquipmentItem;
}

/** Equipment is owned by a character profile, not the account. */
export const useEquipmentStore = (_profileId?: string) => {
  const { userId, profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  const { data: catalog = [], isLoading: catalogLoading } = useQuery({
    queryKey: ["equipment-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_catalog")
        .select("*")
        .eq("is_available", true)
        .order("rarity", { ascending: false });
      if (error) throw error;
      return data as EquipmentItem[];
    },
  });

  const { data: inventory = [], isLoading: inventoryLoading } = useQuery({
    queryKey: ["player-equipment", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("player_equipment_inventory")
        .select(`*, equipment:equipment_catalog(*)`)
        .eq("profile_id", profileId)
        .order("purchased_at", { ascending: false });
      if (error) throw error;
      return data as any as PlayerEquipment[];
    },
    enabled: !!profileId,
  });

  const purchaseEquipment = useMutation({
    mutationFn: async (equipmentId: string) => {
      if (!userId) throw new Error("User not authenticated");
      if (!profileId) throw new Error("Active character not found");
      const equipment = catalog.find((e) => e.id === equipmentId);
      if (!equipment) throw new Error("Equipment not found");
      return purchaseEquipmentAtomic(profileId, equipmentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player-equipment", profileId] });
      queryClient.invalidateQueries({ queryKey: ["equipment-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["profile", profileId] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Equipment purchased successfully");
    },
    onError: (error: any) => toast.error("Failed to purchase equipment", { description: error.message }),
  });

  const maintainEquipment = useMutation({
    mutationFn: async (inventoryId: string) => {
      if (!userId) throw new Error("User not authenticated");
      if (!profileId) throw new Error("Active character not found");
      const item = inventory.find((i) => i.id === inventoryId);
      if (!item) throw new Error("Equipment not found");
      const maintenanceCost = Math.floor(item.equipment.base_price * 0.1);
      const { data: profile } = await supabase.from("profiles").select("cash").eq("id", profileId).single();
      if (!profile || profile.cash < maintenanceCost) throw new Error("Insufficient funds for maintenance");
      const { error: cashError } = await supabase.from("profiles").update({ cash: profile.cash - maintenanceCost }).eq("id", profileId);
      if (cashError) throw cashError;
      const { error } = await supabase
        .from("player_equipment_inventory")
        .update({ condition: 100, last_maintained: new Date().toISOString(), maintenance_cost: maintenanceCost })
        .eq("id", inventoryId)
        .eq("profile_id", profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player-equipment", profileId] });
      toast.success("Equipment maintained successfully");
    },
    onError: (error: any) => toast.error("Failed to maintain equipment", { description: error.message }),
  });

  return { catalog, inventory, isLoading: catalogLoading || inventoryLoading, purchaseEquipment: purchaseEquipment.mutate, maintainEquipment: maintainEquipment.mutate, isPurchasing: purchaseEquipment.isPending, isMaintaining: maintainEquipment.isPending };
};
