import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useGameData } from "@/hooks/useGameData";

interface EquipGearVariables {
  playerEquipmentId: string;
  equip: boolean;
  inventorySource?: "catalog" | "luthiery";
  unequipIds?: string[];
  activityMessage?: string | null;
  activityMetadata?: Record<string, unknown> | null;
}

interface EquipGearResult { id: string; isEquipped: boolean | null; }

export const useEquipPlayerEquipment = () => {
  const { profileId } = useActiveProfile();
  const { addActivity } = useGameData();
  const queryClient = useQueryClient();

  const mutation = useMutation<EquipGearResult, Error, EquipGearVariables>({
    mutationFn: async (variables) => {
      if (!profileId) throw new Error("You must have an active character to update equipment");
      const targetId = variables.playerEquipmentId;
      const inventorySource = variables.inventorySource ?? "catalog";
      const unequipIds = (variables.unequipIds ?? []).filter((id) => id && id !== targetId);
      if (unequipIds.length > 0 && inventorySource === "catalog") {
        const { error: unequipError } = await supabase
          .from("player_equipment_inventory")
          .update({ is_equipped: false })
          .in("id", unequipIds)
          .eq("profile_id", profileId);
        if (unequipError) throw unequipError;
      }

      const table = inventorySource === "luthiery"
        ? "player_equipment"
        : "player_equipment_inventory";
      const payload = inventorySource === "luthiery"
        ? { is_equipped: variables.equip, equipped: variables.equip }
        : { is_equipped: variables.equip };
      const { data, error } = await (supabase as any)
        .from(table)
        .update(payload)
        .eq("id", targetId)
        .eq("profile_id", profileId)
        .select("id, is_equipped")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Gear not found in this character's inventory");
      return { id: data.id, isEquipped: data.is_equipped } satisfies EquipGearResult;
    },
    onSuccess: async (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["player-equipment", profileId] });
      if (variables.equip && variables.activityMessage) {
        try {
          await addActivity("gear_equip", variables.activityMessage, undefined, (variables.activityMetadata ?? null) as any);
        } catch (activityError) {
          console.error("Failed to log gear equip activity", activityError);
        }
      }
    },
    onError: (error) => toast.error(error.message || "Unable to update equipment"),
  });

  return { equipGear: mutation.mutate, equipGearAsync: mutation.mutateAsync, isUpdating: mutation.isPending };
};
