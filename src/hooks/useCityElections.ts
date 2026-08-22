import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  CityElection,
  CityCandidate,
  CityElectionVote,
  CandidateStatus,
  ProposedPolicies,
} from "@/types/city-governance";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";

const ELECTION_ERROR_MESSAGES: Record<string, string> = {
  city_election_auth_required: "You must be logged in to take part in an election.",
  city_election_profile_forbidden: "That character does not belong to your account.",
  city_election_fame_required: "You need at least 100 fame to run for mayor.",
  city_election_not_found: "This election is no longer available.",
  city_election_nominations_closed: "Nominations are closed for this election.",
  city_election_already_candidate: "You are already registered for this election.",
  city_election_voting_closed: "Voting is not currently open for this election.",
  city_election_candidate_invalid: "That candidate is not eligible in this election.",
  city_election_residency_required: "You must be a resident of this city to vote in its election.",
  city_election_already_voted: "You have already voted in this election.",
};

function electionError(error: unknown): Error {
  const raw = error instanceof Error ? error.message : String((error as any)?.message ?? error ?? "Unknown error");
  const code = Object.keys(ELECTION_ERROR_MESSAGES).find((key) => raw.includes(key));
  return new Error(code ? ELECTION_ERROR_MESSAGES[code] : raw);
}

// Fetch the currently active election for a city.
export function useCityElection(cityId: string | undefined) {
  return useQuery({
    queryKey: ["city-election", cityId],
    queryFn: async () => {
      if (!cityId) return null;

      const { data, error } = await supabase
        .from("city_elections")
        .select("*")
        .eq("city_id", cityId)
        .in("status", ["nomination", "voting"])
        .order("election_year", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as CityElection | null;
    },
    enabled: !!cityId,
    refetchInterval: 60_000,
  });
}

// Fetch all elections for a city (including completed)
export function useCityElectionHistory(cityId: string | undefined) {
  return useQuery({
    queryKey: ["city-election-history", cityId],
    queryFn: async () => {
      if (!cityId) return [];

      const { data, error } = await supabase
        .from("city_elections")
        .select("*")
        .eq("city_id", cityId)
        .order("election_year", { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data || []) as CityElection[];
    },
    enabled: !!cityId,
  });
}

// Fetch candidates for an election
export function useElectionCandidates(electionId: string | undefined) {
  return useQuery({
    queryKey: ["election-candidates", electionId],
    queryFn: async () => {
      if (!electionId) return [];

      const { data, error } = await supabase
        .from("city_candidates")
        .select("*")
        .eq("election_id", electionId)
        .in("status", ["pending", "approved"])
        .order("vote_count", { ascending: false });

      if (error) throw error;

      const candidatesWithProfiles = await Promise.all(
        (data || []).map(async (candidate) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, stage_name, avatar_url, fame")
            .eq("id", candidate.profile_id)
            .single();

          return {
            ...candidate,
            profile: profile || undefined,
          };
        }),
      );

      return candidatesWithProfiles as unknown as CityCandidate[];
    },
    enabled: !!electionId,
    refetchInterval: 30_000,
  });
}

// Check if the active character has voted in an election.
export function useUserVote(electionId: string | undefined) {
  const { profileId } = useActiveProfile();

  return useQuery({
    queryKey: ["user-vote", electionId, profileId],
    queryFn: async () => {
      if (!electionId || !profileId) return null;

      const { data, error } = await supabase
        .from("city_election_votes")
        .select("*")
        .eq("election_id", electionId)
        .eq("voter_profile_id", profileId)
        .maybeSingle();

      if (error) throw error;
      return data as CityElectionVote | null;
    },
    enabled: !!electionId && !!profileId,
  });
}

// Cast a vote. Election phase, candidate validity, residency and duplicate-vote
// checks are all repeated by the database authority.
export function useCastVote() {
  const queryClient = useQueryClient();
  const { profileId } = useActiveProfile();

  return useMutation({
    mutationFn: async ({ electionId, candidateId }: { electionId: string; candidateId: string }) => {
      if (!profileId) throw new Error("Must be logged in to vote");

      const { data, error } = await (supabase as any).rpc("cast_city_election_vote", {
        p_election_id: electionId,
        p_candidate_id: candidateId,
        p_profile_id: profileId,
      });

      if (error) throw electionError(error);
      return data as CityElectionVote;
    },
    onSuccess: (_, { electionId }) => {
      queryClient.invalidateQueries({ queryKey: ["user-vote", electionId] });
      queryClient.invalidateQueries({ queryKey: ["election-candidates", electionId] });
      queryClient.invalidateQueries({ queryKey: ["city-election"] });
      toast.success("Vote cast successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Register as a candidate through the server authority. Fame and nomination
// timing can no longer be bypassed with a direct client insert.
export function useRegisterCandidate() {
  const queryClient = useQueryClient();
  const { profileId } = useActiveProfile();

  return useMutation({
    mutationFn: async ({
      electionId,
      slogan,
      proposedPolicies,
    }: {
      electionId: string;
      slogan: string;
      proposedPolicies: ProposedPolicies;
    }) => {
      if (!profileId) throw new Error("Must be logged in to run for mayor");

      const { data, error } = await (supabase as any).rpc("register_city_candidate", {
        p_election_id: electionId,
        p_profile_id: profileId,
        p_slogan: slogan,
        p_proposed_policies: proposedPolicies,
      });

      if (error) throw electionError(error);
      return data as CityCandidate;
    },
    onSuccess: (_, { electionId }) => {
      queryClient.invalidateQueries({ queryKey: ["election-candidates", electionId] });
      toast.success("You are now registered as a candidate!");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Withdrawal remains an owner-only update under the existing RLS policy.
export function useWithdrawCandidacy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (candidateId: string) => {
      const { error } = await supabase
        .from("city_candidates")
        .update({ status: "withdrawn" as CandidateStatus })
        .eq("id", candidateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["election-candidates"] });
      toast.success("Candidacy withdrawn");
    },
  });
}
