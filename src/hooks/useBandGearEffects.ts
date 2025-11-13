import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import {
  EMPTY_GEAR_EFFECTS,
  calculateGearModifiers,
  mapEquippedGearRows,
  type EquippedGearItem,
  type GearModifierEffects,
  type PlayerEquipmentRow,
} from "@/utils/gearModifiers";

interface BandGearEffectsResult {
  gearEffects: GearModifierEffects;
  gearItems: EquippedGearItem[];
}

export const useBandGearEffects = (
  bandId: string | null | undefined,
  options?: { enabled?: boolean }
) => {
  return useQuery<BandGearEffectsResult>({
    queryKey: ["band-gear-effects", bandId],
    enabled: Boolean(bandId) && (options?.enabled ?? true),
    queryFn: async () => {
      if (!bandId) {
        return { gearEffects: { ...EMPTY_GEAR_EFFECTS }, gearItems: [] };
      }

      const { data: members, error: membersError } = await supabase
        .from("band_members")
        .select("user_id")
        .eq("band_id", bandId)
        .eq("is_touring_member", false);

      if (membersError) {
        throw membersError;
      }

      const memberIds = (members ?? []).map((member) => member.user_id).filter(Boolean);

      if (memberIds.length === 0) {
        return { gearEffects: { ...EMPTY_GEAR_EFFECTS }, gearItems: [] };
      }

      const { data: equipmentRows, error: equipmentError } = await supabase
        .from("player_equipment")
        .select(
          "id, user_id, equipment_id, is_equipped, equipment:equipment_items!equipment_id (id, name, category, subcategory, rarity, stat_boosts)"
        )
        .in("user_id", memberIds)
        .eq("is_equipped", true);

      if (equipmentError) {
        throw equipmentError;
      }

      const gearItems = mapEquippedGearRows(equipmentRows as PlayerEquipmentRow[]);
      const gearEffects = calculateGearModifiers(gearItems);

      return { gearEffects, gearItems };
    },
    staleTime: 30 * 1000,
  });
};
