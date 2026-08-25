import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BandOperationPermissions = {
  is_member: boolean;
  role: string | null;
  can_manage_objectives: boolean;
  can_manage_lineup: boolean;
  can_finalise_lineup: boolean;
  can_resolve_lineup_corrections: boolean;
  can_request_correction: boolean;
};

export type BandObjective = {
  id: string;
  band_id: string;
  objective_type: "rehearsal_sessions" | "recording_sessions" | "gigs_performed";
  title: string;
  target_value: number;
  progress_value: number;
  status: "active" | "completed" | "cancelled";
  deadline_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type CohesionEvent = {
  id: string;
  contribution_type: string;
  chemistry_delta: number;
  cohesion_delta: number;
  explanation: string;
  occurred_at: string;
};

export type BandLineupMember = {
  profile_id: string;
  role: string | null;
  instrument_role: string | null;
  profiles: { id: string; username: string | null; display_name: string | null } | null;
};

export type GigLineup = {
  id: string;
  scheduled_date: string;
  status: string | null;
  started_at: string | null;
  completed_at: string | null;
};

export type GigPerformer = {
  id: string;
  gig_id: string;
  profile_id: string;
  role_or_instrument: string | null;
  lineup_status: string;
};

export type GigLineupState = {
  gig_id: string;
  status: "draft" | "finalised";
  version: number;
  finalised_at: string | null;
};

export type GigLineupCorrection = {
  id: string;
  gig_id: string;
  requester_profile_id: string;
  target_profile_id: string;
  requested_action: "add" | "remove";
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  resolution_note: string | null;
  created_at: string;
};

const queryKey = (bandId: string) => ["band-objectives-lineups", bandId] as const;

export function useBandObjectivesAndLineups(bandId: string) {
  return useQuery({
    queryKey: queryKey(bandId),
    enabled: Boolean(bandId),
    queryFn: async () => {
      const client = supabase as any;
      const [permissions, objectives, cohesion, gigs, members, performers, states, corrections] = await Promise.all([
        client.rpc("get_band_operation_permissions", { p_band_id: bandId }),
        client.from("band_objectives").select("id,band_id,objective_type,title,target_value,progress_value,status,deadline_at,completed_at,created_at").eq("band_id", bandId).order("created_at", { ascending: false }),
        client.from("band_cohesion_events").select("id,contribution_type,chemistry_delta,cohesion_delta,explanation,occurred_at").eq("band_id", bandId).order("occurred_at", { ascending: false }).limit(20),
        client.from("gigs").select("id,scheduled_date,status,started_at,completed_at").eq("band_id", bandId).order("scheduled_date", { ascending: true }).limit(25),
        client.from("band_members").select("profile_id,role,instrument_role,profiles:profiles!band_members_profile_id_fkey(id,username,display_name)").eq("band_id", bandId).eq("member_status", "active"),
        client.from("gig_performers").select("id,gig_id,profile_id,role_or_instrument,lineup_status").eq("band_id", bandId),
        client.from("gig_lineup_state").select("gig_id,status,version,finalised_at").eq("band_id", bandId),
        client.from("gig_lineup_correction_requests").select("id,gig_id,requester_profile_id,target_profile_id,requested_action,reason,status,resolution_note,created_at").eq("band_id", bandId).order("created_at", { ascending: false }).limit(30),
      ]);

      for (const response of [permissions, objectives, cohesion, gigs, members, performers, states, corrections]) {
        if (response.error) throw response.error;
      }

      return {
        permissions: (permissions.data ?? {}) as BandOperationPermissions,
        objectives: (objectives.data ?? []) as BandObjective[],
        cohesion: (cohesion.data ?? []) as CohesionEvent[],
        gigs: (gigs.data ?? []) as GigLineup[],
        members: (members.data ?? []) as BandLineupMember[],
        performers: (performers.data ?? []) as GigPerformer[],
        states: (states.data ?? []) as GigLineupState[],
        corrections: (corrections.data ?? []) as GigLineupCorrection[],
      };
    },
  });
}

function useBandAuthorityMutation<TVariables>(bandId: string, mutationFn: (variables: TVariables) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKey(bandId) }),
  });
}

export function useCreateBandObjective(bandId: string) {
  return useBandAuthorityMutation(bandId, async (input: { objectiveType: BandObjective["objective_type"]; targetValue: number; title?: string }) => {
    const { error } = await (supabase as any).rpc("create_band_objective", {
      p_band_id: bandId,
      p_objective_type: input.objectiveType,
      p_target_value: input.targetValue,
      p_title: input.title || null,
      p_deadline_at: null,
    });
    if (error) throw error;
  });
}

export function useCancelBandObjective(bandId: string) {
  return useBandAuthorityMutation(bandId, async (objectiveId: string) => {
    const { error } = await (supabase as any).rpc("cancel_band_objective", { p_objective_id: objectiveId });
    if (error) throw error;
  });
}

export function useSetGigLineup(bandId: string) {
  return useBandAuthorityMutation(bandId, async (input: { gigId: string; profileIds: string[] }) => {
    const { error } = await (supabase as any).rpc("set_gig_lineup", { p_gig_id: input.gigId, p_profile_ids: input.profileIds });
    if (error) throw error;
  });
}

export function useFinaliseGigLineup(bandId: string) {
  return useBandAuthorityMutation(bandId, async (gigId: string) => {
    const { error } = await (supabase as any).rpc("finalise_gig_lineup", { p_gig_id: gigId });
    if (error) throw error;
  });
}

export function useRequestGigLineupCorrection(bandId: string) {
  return useBandAuthorityMutation(bandId, async (input: { gigId: string; targetProfileId: string; action: "add" | "remove"; reason: string }) => {
    const { error } = await (supabase as any).rpc("request_gig_lineup_correction", {
      p_gig_id: input.gigId,
      p_target_profile_id: input.targetProfileId,
      p_requested_action: input.action,
      p_reason: input.reason,
    });
    if (error) throw error;
  });
}

export function useResolveGigLineupCorrection(bandId: string) {
  return useBandAuthorityMutation(bandId, async (input: { requestId: string; decision: "approved" | "rejected" }) => {
    const { error } = await (supabase as any).rpc("resolve_gig_lineup_correction", {
      p_request_id: input.requestId,
      p_decision: input.decision,
      p_resolution_note: null,
    });
    if (error) throw error;
  });
}
