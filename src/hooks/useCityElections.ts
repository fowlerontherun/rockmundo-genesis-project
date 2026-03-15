import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { 
  CityElection, 
  CityCandidate, 
  CityElectionVote,
  CandidateStatus,
  ProposedPolicies 
} from "@/types/city-governance";
import { useAuth } from "@/hooks/use-auth-context";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";

// Fetch current or upcoming election for a city
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
      
      // Fetch profile info separately
      const candidatesWithProfiles = await Promise.all(
        (data || []).map(async (candidate) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, stage_name, avatar_url, fame")
            .eq("id", candidate.profile_id)
            .single();
          
          return {
            ...candidate,
            profile: profile || undefined
          };
        })
      );
      
      return candidatesWithProfiles as unknown as CityCandidate[];
    },
    enabled: !!electionId,
  });
}

// Check if current user has voted in an election
export function useUserVote(electionId: string | undefined) {
  const { user } = useAuth();
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

// Cast a vote
export function useCastVote() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { profileId } = useActiveProfile();

  return useMutation({
    mutationFn: async ({ electionId, candidateId }: { electionId: string; candidateId: string }) => {
      if (!profileId) throw new Error("Must be logged in to vote");

      const { data, error } = await supabase
        .from("city_election_votes")
        .insert({
          election_id: electionId,
          voter_profile_id: profileId,
          candidate_id: candidateId,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("You have already voted in this election");
        }
        throw error;
      }

      return data;
    },
    onSuccess: (_, { electionId }) => {
      queryClient.invalidateQueries({ queryKey: ["user-vote", electionId] });
      queryClient.invalidateQueries({ queryKey: ["election-candidates"] });
      toast.success("Vote cast successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Register as a candidate
export function useRegisterCandidate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
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

      // Get profile fame
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, fame")
        .eq("id", profileId)
        .single();

      if (profileError || !profile) throw new Error("Profile not found");

      // Check fame requirement
      if ((profile.fame || 0) < 100) {
        throw new Error("You need at least 100 fame to run for mayor");
      }

      const insertData = {
        election_id: electionId,
        profile_id: profile.id,
        campaign_slogan: slogan,
        proposed_policies: proposedPolicies as unknown as Record<string, unknown>,
        status: "approved" as CandidateStatus,
      };
      
      const { data, error } = await supabase
        .from("city_candidates")
        .insert(insertData as any)
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("You are already registered for this election");
        }
        throw error;
      }

      return data;
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

// Withdraw candidacy
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
