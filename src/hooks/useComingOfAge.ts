import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCharacterSlots } from "@/hooks/useCharacterSlots";

export interface ConvertChildArgs {
  childId: string;
  slotNumber?: number | null;
}

export function useConvertChildToPlayable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: ConvertChildArgs | string): Promise<string> => {
      const childId = typeof args === "string" ? args : args.childId;
      const slotNumber = typeof args === "string" ? null : args.slotNumber ?? null;
      const { data, error } = await (supabase as any).rpc("convert_child_to_playable", {
        p_child_id: childId,
        p_slot_number: slotNumber,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_newProfileId, args) => {
      const childId = typeof args === "string" ? args : args.childId;
      toast.success("Heir created — a new playable character is ready");
      qc.invalidateQueries({ queryKey: ["player-children"] });
      qc.invalidateQueries({ queryKey: ["player-child", childId] });
      qc.invalidateQueries({ queryKey: ["character-slots"] });
      qc.invalidateQueries({ queryKey: ["character-profiles"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to convert child");
    },
  });
}

/** Convenience hook exposing slot + conversion availability for a child. */
export function useComingOfAgeAvailability(child: { current_age?: number; child_profile_id?: string | null } | null | undefined) {
  const { slots } = useCharacterSlots();
  const ageOk = (child?.current_age ?? 0) >= 18;
  const notYetConverted = !child?.child_profile_id;
  const slotsOk = !!slots && slots.canCreateNew;
  return {
    eligible: ageOk && notYetConverted,
    canConvertNow: ageOk && notYetConverted && slotsOk,
    needsSlot: ageOk && notYetConverted && !slotsOk,
    slots,
  };
}
