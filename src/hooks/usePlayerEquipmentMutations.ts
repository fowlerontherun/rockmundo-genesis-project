import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";

interface EquipGearVariables {
  playerEquipmentId: string;
  equip: boolean;
  unequipIds?: string[];
  activityMessage?: string | null;
  activityMetadata?: Record<string, unknown> | null;
}

interface EquipGearResult {
  id: string;
  isEquipped: boolean | null;
}

export const useEquipPlayerEquipment = () => {
  const { user } = useAuth();
  const { addActivity } = useGameData();
  const queryClient = useQueryClient();

  const mutation = useMutation<EquipGearResult, Error, EquipGearVariables>({
    mutationFn: async (variables) => {
      if (!user?.id) {
        throw new Error("You must be signed in to update equipment");
      }

      const targetId = variables.playerEquipmentId;
      const unequipIds = (variables.unequipIds ?? []).filter((id) => id && id !== targetId);

      if (unequipIds.length > 0) {
        const { error: unequipError } = await supabase
          .from("player_equipment_inventory")
          .update({ is_equipped: false })
          .in("id", unequipIds)
          .eq("user_id", user.id);

        if (unequipError) {
          throw unequipError;
        }
      }

      const { data, error } = await supabase
        .from("player_equipment_inventory")
        .update({ is_equipped: variables.equip })
        .eq("id", targetId)
        .eq("user_id", user.id)
        .select("id, is_equipped")
        .single();

      if (error) {
        throw error;
      }

      return { id: data.id, isEquipped: data.is_equipped } satisfies EquipGearResult;
    },
    onSuccess: async (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["player-equipment", user?.id] });

      if (variables.equip && variables.activityMessage) {
        try {
          await addActivity(
            "gear_equip",
            variables.activityMessage,
            undefined,
            (variables.activityMetadata ?? null) as any,
          );
        } catch (activityError) {
          console.error("Failed to log gear equip activity", activityError);
        }
      }
    },
    onError: (error) => {
      toast.error(error.message || "Unable to update equipment");
    },
  });

  return {
    equipGear: mutation.mutate,
    equipGearAsync: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
};

