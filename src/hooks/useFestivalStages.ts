import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FestivalStage {
  id: string;
  festival_id: string;
  stage_name: string;
  stage_number: number;
  capacity: number;
  genre_focus: string | null;
  created_at: string;
}

export interface FestivalStageSlot {
  id: string;
  stage_id: string;
  festival_id: string;
  day_number: number;
  slot_number: number;
  slot_type: "headliner" | "support" | "opener" | "dj_session";
  band_id: string | null;
  is_npc_dj: boolean;
  npc_dj_genre: string | null;
  npc_dj_quality: number;
  npc_dj_name: string | null;
  start_time: string | null;
  end_time: string | null;
  payout_amount: number;
  status: string;
  created_at: string;
  band?: { name: string } | null;
}

export const useFestivalStages = (festivalId: string | undefined) => {
  return useQuery<FestivalStage[]>({
    queryKey: ["festival-stages", festivalId],
    queryFn: async () => {
      if (!festivalId) return [];
      const { data, error } = await (supabase as any)
        .from("festival_stages")
        .select("*")
        .eq("festival_id", festivalId)
        .order("stage_number", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!festivalId,
  });
};

export const useFestivalStageSlots = (festivalId: string | undefined, stageId?: string) => {
  return useQuery<FestivalStageSlot[]>({
    queryKey: ["festival-stage-slots", festivalId, stageId],
    queryFn: async () => {
      if (!festivalId) return [];
      let query = (supabase as any)
        .from("festival_stage_slots")
        .select("*, band:bands(name)")
        .eq("festival_id", festivalId)
        .order("day_number", { ascending: true })
        .order("slot_number", { ascending: true });
      if (stageId) query = query.eq("stage_id", stageId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!festivalId,
  });
};

export const useCreateFestivalStage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (stage: Omit<FestivalStage, "id" | "created_at">) => {
      const { data, error } = await (supabase as any)
        .from("festival_stages")
        .insert(stage)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["festival-stages", variables.festival_id] });
      toast.success("Stage added!");
    },
    onError: (error: Error) => toast.error(error.message),
  });
};

export const useCreateFestivalSlot = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (slot: Omit<FestivalStageSlot, "id" | "created_at" | "band">) => {
      const { data, error } = await (supabase as any)
        .from("festival_stage_slots")
        .insert(slot)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["festival-stage-slots", variables.festival_id] });
      toast.success("Slot created!");
    },
    onError: (error: Error) => toast.error(error.message),
  });
};

export const useAssignBandToSlot = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ slotId, bandId, payoutAmount, festivalId }: {
      slotId: string;
      bandId: string;
      payoutAmount: number;
      festivalId: string;
    }) => {
      const { data, error } = await (supabase as any)
        .from("festival_stage_slots")
        .update({
          band_id: bandId,
          payout_amount: payoutAmount,
          status: "booked",
          is_npc_dj: false,
        })
        .eq("id", slotId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["festival-stage-slots", variables.festivalId] });
      toast.success("Band assigned to slot!");
    },
    onError: (error: Error) => toast.error(error.message),
  });
};

export const useFillNpcDjSlot = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ slotId, genre, festivalId }: {
      slotId: string;
      genre: string;
      festivalId: string;
    }) => {
      const quality = Math.floor(Math.random() * 21) + 40; // 40-60 range
      const djName = `DJ ${genre} Beats`;
      const { data, error } = await (supabase as any)
        .from("festival_stage_slots")
        .update({
          is_npc_dj: true,
          npc_dj_genre: genre,
          npc_dj_quality: quality,
          npc_dj_name: djName,
          status: "booked",
          band_id: null,
        })
        .eq("id", slotId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["festival-stage-slots", variables.festivalId] });
      toast.success("NPC DJ session booked!");
    },
    onError: (error: Error) => toast.error(error.message),
  });
};
