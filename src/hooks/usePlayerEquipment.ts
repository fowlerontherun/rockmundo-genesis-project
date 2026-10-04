import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
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
  const { profileId } = useActiveProfile();

  return useQuery<PlayerEquipmentData>({
    queryKey: ["player-equipment", profileId],
    queryFn: async () => {
      if (!profileId) return { items: [], poolStatus: [] };

      const equipmentResult = await (supabase as any)
        .from("player_equipment")
        .select(
          `id, equipment_id, condition, is_equipped, created_at,
           equipment:equipment_items!equipment_id (id, name, category, subcategory, price, rarity, description, stat_boosts, stock)`
        )
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false });

      if (equipmentResult.error) throw equipmentResult.error;

      return {
        items: ((equipmentResult.data as PlayerEquipmentWithItem[] | null) ?? []).map((entry) => ({
          ...entry,
          available_at: entry.created_at ?? null,
          available_for_loadout: true,
          loadout_slot_kind: null,
          pool_category: entry.equipment?.category ?? null,
        })),
        // The historical gear-pool migration is not present in production.
        // Keep My Gear usable with the canonical character inventory rather
        // than failing the entire query on a missing compatibility view.
        poolStatus: [],
      };
    },
    enabled: !!profileId,
  });
};
