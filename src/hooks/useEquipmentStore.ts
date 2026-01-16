import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  equipment_id: string;
  condition: number;
  purchased_at: string;
  last_maintained: string | null;
  maintenance_cost: number;
  is_equipped: boolean;
  equipment: EquipmentItem;
}

export const useEquipmentStore = (userId?: string) => {
  const queryClient = useQueryClient();

  // Fetch equipment catalog
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

  // Fetch player inventory
  const { data: inventory = [], isLoading: inventoryLoading } = useQuery({
    queryKey: ["player-equipment", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("player_equipment_inventory")
        .select(`
          *,
          equipment:equipment_catalog(*)
        `)
        .eq("user_id", userId)
        .order("purchased_at", { ascending: false });

      if (error) throw error;
      return data as any as PlayerEquipment[];
    },
    enabled: !!userId,
  });

  // Purchase equipment
  const purchaseEquipment = useMutation({
    mutationFn: async (equipmentId: string) => {
      if (!userId) throw new Error("User not authenticated");

      const equipment = catalog.find((e) => e.id === equipmentId);
      if (!equipment) throw new Error("Equipment not found");

      // Check stock
      const stockQty = (equipment as any).stock_quantity;
      if (stockQty !== undefined && stockQty !== null && stockQty <= 0) {
        throw new Error("Item is out of stock");
      }

      // Check balance
      const { data: profile } = await supabase
        .from("profiles")
        .select("cash")
        .eq("user_id", userId)
        .single();

      if (!profile || profile.cash < equipment.base_price) {
        throw new Error("Insufficient funds");
      }

      // Deduct cost
      const { error: cashError } = await supabase
        .from("profiles")
        .update({ cash: profile.cash - equipment.base_price })
        .eq("user_id", userId);

      if (cashError) throw cashError;

      // Decrease stock if stock tracking is enabled
      if (stockQty !== undefined && stockQty !== null) {
        await supabase
          .from("equipment_catalog")
          .update({ stock_quantity: stockQty - 1 })
          .eq("id", equipmentId);
      }

      // Add to inventory
      const { data, error } = await supabase
        .from("player_equipment_inventory")
        .insert({
          user_id: userId,
          equipment_id: equipmentId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player-equipment", userId] });
      queryClient.invalidateQueries({ queryKey: ["equipment-catalog"] });
      toast.success("Equipment purchased successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to purchase equipment", { description: error.message });
    },
  });

  // Maintain equipment
  const maintainEquipment = useMutation({
    mutationFn: async (inventoryId: string) => {
      if (!userId) throw new Error("User not authenticated");

      const item = inventory.find((i) => i.id === inventoryId);
      if (!item) throw new Error("Equipment not found");

      const maintenanceCost = Math.floor(item.equipment.base_price * 0.1);

      // Check balance
      const { data: profile } = await supabase
        .from("profiles")
        .select("cash")
        .eq("user_id", userId)
        .single();

      if (!profile || profile.cash < maintenanceCost) {
        throw new Error("Insufficient funds for maintenance");
      }

      // Deduct cost
      const { error: cashError } = await supabase
        .from("profiles")
        .update({ cash: profile.cash - maintenanceCost })
        .eq("user_id", userId);

      if (cashError) throw cashError;

      // Update equipment
      const { error } = await supabase
        .from("player_equipment_inventory")
        .update({
          condition: 100,
          last_maintained: new Date().toISOString(),
          maintenance_cost: maintenanceCost,
        })
        .eq("id", inventoryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player-equipment", userId] });
      toast.success("Equipment maintained successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to maintain equipment", { description: error.message });
    },
  });

  return {
    catalog,
    inventory,
    isLoading: catalogLoading || inventoryLoading,
    purchaseEquipment: purchaseEquipment.mutate,
    maintainEquipment: maintainEquipment.mutate,
    isPurchasing: purchaseEquipment.isPending,
    isMaintaining: maintainEquipment.isPending,
  };
};
