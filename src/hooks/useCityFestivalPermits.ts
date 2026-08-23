import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FestivalPermitStatus =
  | "not_ready"
  | "not_required"
  | "not_applied"
  | "pending"
  | "approved"
  | "rejected"
  | "revoked";

export interface FestivalCityPermitStatus {
  festivalCompanyId: string;
  festivalEditionId: string;
  cityId: string | null;
  startsOn: string | null;
  permitRequired: boolean;
  cityLawId: string | null;
  permitId: string | null;
  status: FestivalPermitStatus;
  applicationNote: string | null;
  decisionReason: string | null;
  appliedAt: string | null;
  decidedAt: string | null;
}

export interface MayorFestivalPermit {
  permitId: string;
  festivalEditionId: string;
  festivalCompanyId: string;
  festivalName: string;
  startsOn: string | null;
  endsOn: string | null;
  status: "pending" | "approved" | "rejected" | "revoked";
  applicationNote: string | null;
  appliedAt: string;
  decisionReason: string | null;
  decidedAt: string | null;
}

const editionKey = (editionId?: string) => ["festival-city-permit", editionId] as const;
const cityQueueKey = (cityId?: string) => ["city-festival-permit-queue", cityId] as const;

export function useFestivalCityPermit(editionId?: string) {
  return useQuery({
    queryKey: editionKey(editionId),
    enabled: Boolean(editionId),
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "get_festival_city_permit_status_for_edition",
        { p_festival_edition_id: editionId },
      );
      if (error) throw error;
      return data as FestivalCityPermitStatus;
    },
  });
}

export function useApplyForFestivalCityPermit() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      editionId,
      applicationNote,
    }: {
      editionId: string;
      applicationNote?: string;
    }) => {
      const { data, error } = await (supabase as any).rpc(
        "apply_for_festival_city_permit_for_edition",
        {
          p_festival_edition_id: editionId,
          p_idempotency_key: crypto.randomUUID(),
          p_application_note: applicationNote?.trim() || null,
        },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: async (_, variables) => {
      await client.invalidateQueries({ queryKey: editionKey(variables.editionId) });
    },
  });
}

export function useMayorFestivalPermitQueue(cityId?: string) {
  return useQuery({
    queryKey: cityQueueKey(cityId),
    enabled: Boolean(cityId),
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "get_city_festival_permit_queue",
        { p_city_id: cityId },
      );
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as MayorFestivalPermit[];
    },
  });
}

export function useDecideFestivalCityPermit(cityId?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      permitId,
      decision,
      reason,
    }: {
      permitId: string;
      decision: "approved" | "rejected" | "revoked";
      reason?: string;
    }) => {
      const { data, error } = await (supabase as any).rpc(
        "decide_city_festival_permit",
        {
          p_permit_id: permitId,
          p_decision: decision,
          p_reason: reason?.trim() || null,
          p_idempotency_key: crypto.randomUUID(),
        },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: cityQueueKey(cityId) });
      await client.invalidateQueries({ queryKey: ["festival-city-permit"] });
    },
  });
}
