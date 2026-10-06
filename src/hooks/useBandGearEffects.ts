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
        .select("user_id, profile_id")
        .eq("band_id", bandId)
        .eq("is_touring_member", false);

      if (membersError) {
        throw membersError;
      }

      const memberIds = (members ?? []).map((member) => member.user_id).filter(Boolean);
      const profileIds = (members ?? []).map((member) => member.profile_id).filter(Boolean);

      if (profileIds.length === 0) {
        return { gearEffects: { ...EMPTY_GEAR_EFFECTS }, gearItems: [] };
      }

      const [legacyResult, catalogResult] = await Promise.all([
        (supabase as any)
          .from("player_equipment")
          .select(
            "id, user_id, equipment_id, is_equipped, equipment:equipment_items!equipment_id (id, name, category, subcategory, rarity, stat_boosts)"
          )
          .in("profile_id", profileIds)
          .or("is_equipped.eq.true,equipped.eq.true"),
        (supabase as any)
          .from("player_equipment_inventory")
          .select(
            "id, user_id, equipment_id, is_equipped, equipment:equipment_catalog!equipment_id (id, name, category, subcategory, rarity, stat_boosts)"
          )
          .in("profile_id", profileIds)
          .eq("is_equipped", true),
      ]);

      if (legacyResult.error) throw legacyResult.error;
      if (catalogResult.error) throw catalogResult.error;

      const equipmentRows = [
        ...((legacyResult.data ?? []) as PlayerEquipmentRow[]),
        ...((catalogResult.data ?? []) as PlayerEquipmentRow[]),
      ];

      // Preserve the account id fallback for very old rows while all current
      // membership/equipment reads remain scoped to the character profile.
      const memberIdSet = new Set(memberIds);
      const gearItems = mapEquippedGearRows(equipmentRows).filter(
        (item) => !item.userId || memberIdSet.has(item.userId),
      );
      const gearEffects = calculateGearModifiers(gearItems);

      return { gearEffects, gearItems };
    },
    staleTime: 30 * 1000,
  });
};
