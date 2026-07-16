import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PublicParticipantProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type RehearsalParticipant = {
  id: string;
  rehearsal_id: string;
  band_id: string;
  profile_id: string;
  participation_status: string;
  responded_at: string | null;
  finalised_by_profile_id?: string | null;
  finalised_at?: string | null;
  finaliser?: PublicParticipantProfile | null;
  profiles: PublicParticipantProfile | null;
};

export type GigPerformer = {
  id: string;
  gig_id: string;
  band_id: string;
  profile_id: string;
  role_or_instrument: string | null;
  lineup_status: string;
  profiles: PublicParticipantProfile | null;
};

const profileSelect = "id, username, display_name, avatar_url";

export function useRehearsalParticipants(rehearsalId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["rehearsal-participants", rehearsalId],
    enabled: enabled && !!rehearsalId,
    queryFn: async (): Promise<RehearsalParticipant[]> => {
      const { data, error } = await (supabase as any)
        .from("band_rehearsal_participants")
        .select(`id, rehearsal_id, band_id, profile_id, participation_status, responded_at, finalised_by_profile_id, finalised_at, finaliser:profiles!band_rehearsal_participants_finalised_by_profile_id_fkey(${profileSelect}), profiles:profiles!band_rehearsal_participants_profile_id_fkey(${profileSelect})`)
        .eq("rehearsal_id", rehearsalId)
        .order("participation_status", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        // Table not yet provisioned in this environment — treat as no participant rows recorded
        // so completed rehearsals show the "unavailable for older event" empty state instead of an error card.
        const code = (error as any)?.code;
        const message = (error as any)?.message ?? "";
        if (code === "42P01" || code === "PGRST205" || /does not exist|schema cache/i.test(message)) {
          return [];
        }
        throw error;
      }
      return (data ?? []) as RehearsalParticipant[];
    },
  });
}


export function useGigPerformers(gigId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["gig-performers", gigId],
    enabled: enabled && !!gigId,
    queryFn: async (): Promise<GigPerformer[]> => {
      const { data, error } = await (supabase as any)
        .from("gig_performers")
        .select(`id, gig_id, band_id, profile_id, role_or_instrument, lineup_status, profiles:profiles!gig_performers_profile_id_fkey(${profileSelect})`)
        .eq("gig_id", gigId)
        .order("lineup_status", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as GigPerformer[];
    },
  });
}

export type RehearsalAttendanceCorrectionRequest = {
  id: string;
  rehearsal_id: string;
  participant_id: string;
  band_id: string;
  requester_profile_id: string;
  current_status: "attended" | "missed";
  requested_status: "attended" | "missed";
  request_reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  created_at: string;
  resolved_at: string | null;
  resolved_by_profile_id: string | null;
  resolution_note: string | null;
  sole_resolver_exception?: boolean;
  eligibility?: CorrectionResolutionEligibility | null;
  profiles?: PublicParticipantProfile | null;
};

export type CorrectionResolutionEligibility = {
  correction_request_id: string;
  can_resolve: boolean;
  is_original_finaliser: boolean;
  alternative_resolver_exists: boolean;
  sole_resolver_exception_available: boolean;
  legacy_finaliser: boolean;
  denial_reason: string | null;
};

export function useRehearsalAttendanceCorrectionRequests(rehearsalId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["rehearsal-attendance-corrections", rehearsalId],
    enabled: enabled && !!rehearsalId,
    queryFn: async (): Promise<RehearsalAttendanceCorrectionRequest[]> => {
      const { data, error } = await (supabase as any)
        .from("rehearsal_attendance_correction_requests")
        .select(`id, rehearsal_id, participant_id, band_id, requester_profile_id, current_status, requested_status, request_reason, status, created_at, resolved_at, resolved_by_profile_id, resolution_note, sole_resolver_exception, profiles:profiles!rehearsal_attendance_correction_requests_requester_profile_id_fkey(${profileSelect})`)
        .eq("rehearsal_id", rehearsalId)
        .order("created_at", { ascending: false });
      if (error) {
        const code = (error as any)?.code;
        const message = (error as any)?.message ?? "";
        if (code === "42P01" || code === "PGRST205" || /does not exist|schema cache/i.test(message)) {
          return [];
        }
        throw error;
      }
      const requests = (data ?? []) as RehearsalAttendanceCorrectionRequest[];
      if (requests.some((request) => request.status === "pending")) {
        const { data: eligibilityRows } = await (supabase as any).rpc(
          "get_rehearsal_attendance_correction_resolution_eligibilities",
          { p_rehearsal_id: rehearsalId },
        );
        const byId = new Map(
          ((eligibilityRows ?? []) as CorrectionResolutionEligibility[]).map((row) => [
            row.correction_request_id,
            row,
          ]),
        );
        return requests.map((request) => ({ ...request, eligibility: byId.get(request.id) ?? null }));
      }
      return requests;
    },
  });
}
