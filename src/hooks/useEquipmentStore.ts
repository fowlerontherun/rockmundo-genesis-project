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

export interface LuthieryEquipmentDetail {
  maker_name: string;
  shape_id: string;
  shape_name: string;
  colour: string;
  finish_id: string;
  finish_name: string;
  final_quality: number;
  material_snapshot: Array<Record<string, unknown>>;
  final_stats: Record<string, number>;
  build_spec: Record<string, unknown>;
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
  inventory_source?: "catalog" | "luthiery";
  luthiery?: LuthieryEquipmentDetail | null;
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
      const [catalogResult, luthieryResult] = await Promise.all([
        supabase
          .from("player_equipment_inventory")
          .select(`*, equipment:equipment_catalog(*)`)
          .eq("profile_id", profileId)
          .order("purchased_at", { ascending: false }),
        (supabase as any).rpc("get_owned_luthiery_equipment_details", {
          p_profile_id: profileId,
        }),
      ]);
      if (catalogResult.error) throw catalogResult.error;
      if (luthieryResult.error) throw luthieryResult.error;

      const catalogInventory = ((catalogResult.data ?? []) as any[]).map((row) => ({
        ...row,
        inventory_source: "catalog" as const,
        luthiery: null,
      })) as PlayerEquipment[];

      const craftedInventory = ((luthieryResult.data ?? []) as any[]).map((row) => ({
        id: row.player_equipment_id,
        profile_id: profileId,
        equipment_id: row.equipment_id,
        condition: Number(row.condition ?? 100),
        purchased_at: row.purchased_at ?? new Date(0).toISOString(),
        last_maintained: null,
        maintenance_cost: 0,
        is_equipped: Boolean(row.is_equipped),
        inventory_source: "luthiery" as const,
        luthiery: {
          maker_name: row.maker_name,
          shape_id: row.shape_id,
          shape_name: row.shape_name,
          colour: row.colour,
          finish_id: row.finish_id,
          finish_name: row.finish_name,
          final_quality: Number(row.final_quality ?? 0),
          material_snapshot: Array.isArray(row.material_snapshot) ? row.material_snapshot : [],
          final_stats: row.final_stats ?? {},
          build_spec: row.build_spec ?? {},
        },
        equipment: {
          id: row.equipment_id,
          name: row.instrument_name,
          category: row.category,
          subcategory: row.subcategory,
          brand: "Player Crafted",
          description: row.description,
          base_price: Number(row.estimated_value ?? 1000),
          quality_rating: Number(row.final_quality ?? 0),
          durability: 100,
          stat_boosts: row.stat_boosts ?? {},
          rarity: row.rarity ?? "common",
          required_level: 1,
          image_url: null,
          is_available: false,
        },
      })) as PlayerEquipment[];

      return [...craftedInventory, ...catalogInventory];
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
      const equipmentTable = item.inventory_source === "luthiery"
        ? "player_equipment"
        : "player_equipment_inventory";
      const updatePayload = item.inventory_source === "luthiery"
        ? { condition: 100 }
        : { condition: 100, last_maintained: new Date().toISOString(), maintenance_cost: maintenanceCost };
      const { error } = await (supabase as any)
        .from(equipmentTable)
        .update(updatePayload)
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
