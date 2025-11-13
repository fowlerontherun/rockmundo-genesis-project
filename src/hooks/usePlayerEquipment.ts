import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { type EquipmentItemRecord } from "@/types/gear";

export interface PlayerEquipmentWithItem {
  available_at: string | null;
  available_for_loadout: boolean;
  id: string;
  equipment_id: string;
  condition: number | null;
  is_equipped: boolean | null;
  created_at: string | null;
  loadout_slot_kind: string | null;
  pool_category: string | null;
  equipment?: {
    id: string;
    name: string;
    category: string;
    subcategory: string | null;
    price: number;
    rarity: string | null;
    description: string | null;
    stat_boosts: Record<string, number> | null;
    stock: number | null;
  } | null;
}

export interface PlayerGearPoolStatus {
  user_id: string | null;
  category: string | null;
  slot_kind: string | null;
  capacity: number | null;
  used_count: number | null;
  available_slots: number | null;
  default_capacity: number | null;
  catalog_slot_kind: string | null;
  updated_at: string | null;
}

export interface PlayerEquipmentData {
  items: PlayerEquipmentWithItem[];
  poolStatus: PlayerGearPoolStatus[];
}

export const usePlayerEquipment = () => {
  const { user } = useAuth();

  return useQuery<PlayerEquipmentData>({
    queryKey: ["player-equipment", user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return { items: [], poolStatus: [] };
      }

      const [equipmentResult, poolResult] = await Promise.all([
        supabase
          .from("player_equipment")
          .select(
            `id, equipment_id, condition, is_equipped, created_at, available_for_loadout, available_at, loadout_slot_kind, pool_category,
             equipment:equipment_items!equipment_id (id, name, category, subcategory, price, rarity, description, stat_boosts, stock)`
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("player_gear_pool_status")
          .select("user_id, category, slot_kind, capacity, used_count, available_slots, default_capacity, catalog_slot_kind, updated_at")
          .eq("user_id", user.id),
      ]);

      if (equipmentResult.error) {
        throw equipmentResult.error;
      }

      if (poolResult.error) {
        throw poolResult.error;
      }

      return {
        items: ((equipmentResult.data as PlayerEquipmentWithItem[] | null) ?? []).map((entry) => ({
          ...entry,
          available_at: entry.available_at ?? null,
          available_for_loadout: Boolean(entry.available_for_loadout),
        })),
        poolStatus: (poolResult.data as PlayerGearPoolStatus[] | null) ?? [],
      };
    },
    enabled: !!user?.id,
  });
};
