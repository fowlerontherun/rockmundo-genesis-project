import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";

export interface PartyEndorsement {
  id: string;
  party_id: string;
  candidate_id: string;
  election_id: string;
  endorsed_by_profile_id: string;
  statement: string | null;
  created_at: string;
  party?: {
    id: string;
    name: string;
    colour_hex: string;
  } | null;
}

export function useElectionEndorsements(electionId: string | undefined) {
  return useQuery({
    queryKey: ["party-endorsements", electionId],
    queryFn: async () => {
      if (!electionId) return [];
      const { data, error } = await supabase
        .from("party_endorsements")
        .select("*, party:political_parties(id, name, colour_hex)")
        .eq("election_id", electionId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PartyEndorsement[];
    },
    enabled: !!electionId,
  });
}

export function useEndorseCandidate() {
  const queryClient = useQueryClient();
  const { profileId } = useActiveProfile();

  return useMutation({
    mutationFn: async (input: {
      party_id: string;
      candidate_id: string;
      election_id: string;
      statement?: string;
    }) => {
      if (!profileId) throw new Error("Sign in first");
      const { data, error } = await supabase.rpc("endorse_candidate", {
        p_party_id: input.party_id,
        p_candidate_id: input.candidate_id,
        p_statement: input.statement ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_, vars) => {
      toast.success("Endorsement issued");
      queryClient.invalidateQueries({ queryKey: ["party-endorsements", vars.election_id] });
      queryClient.invalidateQueries({ queryKey: ["election-candidates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRevokeEndorsement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { party_id: string; election_id: string }) => {
      const { error } = await supabase.rpc("revoke_endorsement", {
        p_party_id: input.party_id,
        p_election_id: input.election_id,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success("Endorsement revoked");
      queryClient.invalidateQueries({ queryKey: ["party-endorsements", vars.election_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
