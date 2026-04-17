import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";

export function useNominateCandidate() {
  const queryClient = useQueryClient();
  const { profileId } = useActiveProfile();

  return useMutation({
    mutationFn: async (input: {
      election_id: string;
      nominee_profile_id: string;
      campaign_slogan?: string;
    }) => {
      if (!profileId) throw new Error("Sign in first");
      if (input.nominee_profile_id === profileId) {
        throw new Error("You can't nominate yourself");
      }

      const { error } = await supabase.from("city_candidates").insert({
        election_id: input.election_id,
        profile_id: input.nominee_profile_id,
        nominator_profile_id: profileId,
        nominated_at: new Date().toISOString(),
        campaign_slogan: input.campaign_slogan ?? "",
        status: "pending",
      });
      if (error) {
        if (error.code === "23505") {
          throw new Error("This player is already nominated for this election");
        }
        throw error;
      }
    },
    onSuccess: (_, vars) => {
      toast.success("Nomination submitted — awaiting a seconder");
      queryClient.invalidateQueries({ queryKey: ["election-candidates", vars.election_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSecondNomination() {
  const queryClient = useQueryClient();
  const { profileId } = useActiveProfile();

  return useMutation({
    mutationFn: async (candidateId: string) => {
      if (!profileId) throw new Error("Sign in first");

      const { data: cand } = await supabase
        .from("city_candidates")
        .select("id, profile_id, nominator_profile_id, seconder_profile_id")
        .eq("id", candidateId)
        .maybeSingle();
      if (!cand) throw new Error("Nomination not found");
      if (cand.seconder_profile_id) throw new Error("Already seconded");
      if (cand.profile_id === profileId) throw new Error("Candidates can't second themselves");
      if (cand.nominator_profile_id === profileId) throw new Error("Nominator can't second");

      const { error } = await supabase
        .from("city_candidates")
        .update({
          seconder_profile_id: profileId,
          seconded_at: new Date().toISOString(),
          status: "approved",
        })
        .eq("id", candidateId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nomination seconded");
      queryClient.invalidateQueries({ queryKey: ["election-candidates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
