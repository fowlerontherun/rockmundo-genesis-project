import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const db = supabase as any;

export type SocialContractStatus = "draft" | "offered" | "active" | "completed" | "cancelled" | "disputed";
export type SocialContractPartyStatus = "invited" | "accepted" | "declined" | "withdrawn";

export interface SocialContractSummary {
  contract_id: string;
  contract_type: string;
  title: string;
  status: SocialContractStatus;
  visibility: "private" | "parties" | "public";
  deadline_at: string | null;
  created_by_profile_id: string;
  version: number;
  my_role: string;
  my_party_status: SocialContractPartyStatus;
  updated_at: string;
}

export function useMySocialContracts() {
  return useQuery({
    queryKey: ["social-contracts", "mine"],
    queryFn: async () => {
      const { data, error } = await db.rpc("get_my_social_contracts");
      if (error) throw error;
      return (data ?? []) as SocialContractSummary[];
    },
  });
}

function invalidateContracts(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: ["social-contracts"] });
}

export function useRespondToSocialContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, accept }: { contractId: string; accept: boolean }) => {
      const { data, error } = await db.rpc("respond_to_social_contract", {
        p_contract_id: contractId,
        p_accept: accept,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.accept ? "Contract accepted" : "Contract declined");
      invalidateContracts(queryClient);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useOfferSocialContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (contractId: string) => {
      const { data, error } = await db.rpc("offer_social_contract", { p_contract_id: contractId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Contract offered");
      invalidateContracts(queryClient);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useCancelSocialContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, reason }: { contractId: string; reason?: string }) => {
      const { data, error } = await db.rpc("cancel_social_contract", {
        p_contract_id: contractId,
        p_reason: reason ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Contract cancelled");
      invalidateContracts(queryClient);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useOpenSocialContractDispute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, reasonCode, details }: { contractId: string; reasonCode: string; details?: string }) => {
      const { data, error } = await db.rpc("open_social_contract_dispute", {
        p_contract_id: contractId,
        p_reason_code: reasonCode,
        p_details: details ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success("Dispute opened with server evidence attached");
      invalidateContracts(queryClient);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
