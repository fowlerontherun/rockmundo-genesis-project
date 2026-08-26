import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const db = supabase as any;

export type MusicCollaborationType =
  | "guest_feature"
  | "co_writing"
  | "production_credit"
  | "session_musician"
  | "tour_participation"
  | "live_guest";

export interface MusicCollaborationParty {
  partyType: "band" | "profile";
  partyId: string;
  role: string;
  status: "invited" | "accepted" | "declined" | "withdrawn";
  obligations: string[];
  paymentTerms: {
    royaltyBasisPoints?: number;
    fixedFeeMinor?: number;
    currencyCode?: string;
  };
  acceptedAt?: string | null;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface MusicCollaborationCredit {
  id: string;
  profileId: string;
  creditRole: string;
  royaltyBasisPoints: number;
  fixedFeeMinor: number;
  obligations: string[];
  activatedAt?: string | null;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface MusicCollaborationContract {
  id: string;
  bandId: string;
  collaborationType: MusicCollaborationType;
  title: string;
  summary: string;
  status: "draft" | "offered" | "active" | "completed" | "cancelled" | "disputed";
  version: number;
  terms: {
    bandId: string;
    collaborationType: MusicCollaborationType;
    bandObligations: string[];
    bandRoyaltyBasisPoints: number;
    royaltyTotalBasisPoints: number;
  };
  deliverables: string[];
  deadlineAt?: string | null;
  offeredAt?: string | null;
  activatedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  createdByProfileId: string;
  songId?: string | null;
  songwritingProjectId?: string | null;
  recordingSessionId?: string | null;
  tourId?: string | null;
  gigId?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  parties: MusicCollaborationParty[];
  credits: MusicCollaborationCredit[];
  escrows: Array<{
    id: string;
    payeeProfileId: string;
    amountMinor: number;
    currencyCode: string;
    status: string;
    fundedAt?: string | null;
    releasedAt?: string | null;
    refundedAt?: string | null;
  }>;
}

export interface MusicCollaborationWorkspace {
  permissions: { canManage: boolean; profileId: string };
  contracts: MusicCollaborationContract[];
  sources: {
    songs: Array<{ id: string; title: string; status: string }>;
    recordingSessions: Array<{ id: string; songId?: string | null; status: string; scheduledStart?: string | null }>;
    gigs: Array<{ id: string; status: string; scheduledDate?: string | null }>;
    tours: Array<{ id: string; name: string; status: string; startDate?: string | null; endDate?: string | null }>;
    songwritingProjects: Array<{ id: string; title: string; status: string; songId?: string | null }>;
  };
}

export interface CreateMusicCollaborationPayload {
  bandId: string;
  collaborationType: MusicCollaborationType;
  title: string;
  summary: string;
  bandObligations: string[];
  deliverables: string[];
  bandRoyaltyBasisPoints: number;
  participants: Array<{
    profileId: string;
    role: string;
    creditRole: string;
    obligations: string[];
    royaltyBasisPoints: number;
    fixedFeeMinor: number;
  }>;
  songId?: string | null;
  songwritingProjectId?: string | null;
  recordingSessionId?: string | null;
  tourId?: string | null;
  gigId?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["music-collaboration"] }),
    queryClient.invalidateQueries({ queryKey: ["social-contracts"] }),
  ]);
}

export function useBandMusicCollaborationWorkspace(bandId?: string) {
  return useQuery({
    queryKey: ["music-collaboration", "band", bandId],
    enabled: Boolean(bandId),
    queryFn: async () => {
      const { data, error } = await db.rpc("get_band_music_collaboration_workspace", { p_band_id: bandId });
      if (error) throw error;
      return data as MusicCollaborationWorkspace;
    },
  });
}

export function useMyMusicCollaborationContracts() {
  return useQuery({
    queryKey: ["music-collaboration", "mine"],
    queryFn: async () => {
      const { data, error } = await db.rpc("get_my_music_collaboration_contracts");
      if (error) throw error;
      return data as { profileId: string; contracts: MusicCollaborationContract[] };
    },
  });
}

export function useCreateMusicCollaborationContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateMusicCollaborationPayload) => {
      const { data, error } = await db.rpc("create_music_collaboration_contract", {
        p_payload: payload,
        p_client_idempotency_key: crypto.randomUUID(),
      });
      if (error) throw error;
      return data as MusicCollaborationContract;
    },
    onSuccess: async () => {
      toast.success("Collaboration offer created and fixed fees escrowed");
      await invalidate(queryClient);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useRespondToMusicCollaborationContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, accept }: { contractId: string; accept: boolean }) => {
      const { data, error } = await db.rpc("respond_to_music_collaboration_contract", {
        p_contract_id: contractId,
        p_accept: accept,
        p_idempotency_key: crypto.randomUUID(),
      });
      if (error) throw error;
      return data as MusicCollaborationContract;
    },
    onSuccess: async (_, variables) => {
      toast.success(variables.accept ? "Collaboration accepted" : "Collaboration declined");
      await invalidate(queryClient);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useCancelMusicCollaborationContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (contractId: string) => {
      const { data, error } = await db.rpc("cancel_music_collaboration_contract", {
        p_contract_id: contractId,
        p_idempotency_key: crypto.randomUUID(),
      });
      if (error) throw error;
      return data as MusicCollaborationContract;
    },
    onSuccess: async () => {
      toast.success("Collaboration offer cancelled and funded fees refunded");
      await invalidate(queryClient);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSettleMusicCollaborationContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (contractId: string) => {
      const { data, error } = await db.rpc("settle_music_collaboration_contract", {
        p_contract_id: contractId,
        p_idempotency_key: crypto.randomUUID(),
      });
      if (error) throw error;
      return data as MusicCollaborationContract;
    },
    onSuccess: async () => {
      toast.success("Collaboration settled from verified gameplay evidence");
      await invalidate(queryClient);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
