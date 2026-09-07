import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FestivalOwnerNpcAct = {
  id: string;
  displayName: string;
  genre: string | null;
  fame: number;
  setMinutes: number;
  festivalDate: string;
  stageId: string | null;
  billingPosition: "headliner" | "sub_headliner" | "featured" | "support" | "emerging" | "special_guest";
  status: "confirmed" | "cancelled";
  updatedAt: string;
};

const key = (festivalCompanyId: string, festivalEditionId: string) => [
  "festival-owner-npc-lineup",
  festivalCompanyId,
  festivalEditionId,
] as const;

export const useFestivalOwnerNpcActs = (festivalCompanyId: string, festivalEditionId: string) =>
  useQuery({
    queryKey: key(festivalCompanyId, festivalEditionId),
    enabled: Boolean(festivalCompanyId && festivalEditionId),
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_festival_owner_npc_lineup_acts", {
        p_festival_company_id: festivalCompanyId,
        p_festival_edition_id: festivalEditionId,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as FestivalOwnerNpcAct[];
    },
  });

export const useUpsertFestivalOwnerNpcAct = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      festivalCompanyId: string;
      festivalEditionId: string;
      npcActId?: string | null;
      displayName: string;
      genre?: string | null;
      fame: number;
      setMinutes: number;
      festivalDate: string;
      stageId?: string | null;
      billingPosition: FestivalOwnerNpcAct["billingPosition"];
    }) => {
      const { data, error } = await (supabase as any).rpc("upsert_festival_owner_npc_lineup_act", {
        p_festival_company_id: input.festivalCompanyId,
        p_festival_edition_id: input.festivalEditionId,
        p_npc_act_id: input.npcActId ?? null,
        p_display_name: input.displayName,
        p_genre: input.genre ?? null,
        p_fame: input.fame,
        p_set_minutes: input.setMinutes,
        p_festival_date: input.festivalDate,
        p_stage_id: input.stageId ?? null,
        p_billing_position: input.billingPosition,
        p_idempotency_key: crypto.randomUUID(),
      });
      if (error) throw error;
      return data as FestivalOwnerNpcAct;
    },
    onSuccess: (_, input) => Promise.all([
      client.invalidateQueries({ queryKey: key(input.festivalCompanyId, input.festivalEditionId) }),
      client.invalidateQueries({ queryKey: ["festival-artist-programme"] }),
      client.invalidateQueries({ queryKey: ["public-festival"] }),
      client.invalidateQueries({ queryKey: ["public-festival-timetable"] }),
    ]),
  });
};

export const useCancelFestivalOwnerNpcAct = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { festivalCompanyId: string; festivalEditionId: string; npcActId: string }) => {
      const { data, error } = await (supabase as any).rpc("cancel_festival_owner_npc_lineup_act", {
        p_festival_company_id: input.festivalCompanyId,
        p_festival_edition_id: input.festivalEditionId,
        p_npc_act_id: input.npcActId,
        p_idempotency_key: crypto.randomUUID(),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, input) => Promise.all([
      client.invalidateQueries({ queryKey: key(input.festivalCompanyId, input.festivalEditionId) }),
      client.invalidateQueries({ queryKey: ["public-festival"] }),
      client.invalidateQueries({ queryKey: ["public-festival-timetable"] }),
    ]),
  });
};
