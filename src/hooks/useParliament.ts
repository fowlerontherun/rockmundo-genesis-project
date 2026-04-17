import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";
import type {
  MayorPaySettings,
  MayorSalaryPayment,
  MotionType,
  ParliamentMotion,
  ParliamentVote,
  Vote,
} from "@/types/parliament";

export function useParliamentMotions(status?: "open" | "all") {
  return useQuery({
    queryKey: ["parliament-motions", status ?? "open"],
    queryFn: async () => {
      let q = supabase
        .from("world_parliament_motions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (!status || status === "open") q = q.eq("status", "open");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ParliamentMotion[];
    },
  });
}

export function useMotion(motionId: string | undefined) {
  return useQuery({
    queryKey: ["parliament-motion", motionId],
    queryFn: async () => {
      if (!motionId) return null;
      const { data, error } = await supabase
        .from("world_parliament_motions")
        .select("*")
        .eq("id", motionId)
        .maybeSingle();
      if (error) throw error;
      return data as ParliamentMotion | null;
    },
    enabled: !!motionId,
  });
}

export function useMotionVotes(motionId: string | undefined) {
  return useQuery({
    queryKey: ["parliament-votes", motionId],
    queryFn: async () => {
      if (!motionId) return [];
      const { data, error } = await supabase
        .from("world_parliament_votes")
        .select("*")
        .eq("motion_id", motionId);
      if (error) throw error;
      return (data ?? []) as ParliamentVote[];
    },
    enabled: !!motionId,
  });
}

export function useMyMayorSeat() {
  const { profileId } = useActiveProfile();
  return useQuery({
    queryKey: ["my-mayor-seat", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data, error } = await supabase
        .from("city_mayors")
        .select("id, city_id, profile_id, is_current, term_end")
        .eq("profile_id", profileId)
        .eq("is_current", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profileId,
  });
}

export function useMayorPaySettings() {
  return useQuery({
    queryKey: ["mayor-pay-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mayor_pay_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data as MayorPaySettings | null;
    },
  });
}

export function useMyMayorSalaryHistory() {
  const { profileId } = useActiveProfile();
  return useQuery({
    queryKey: ["mayor-salary-history", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("mayor_salary_payments")
        .select("*")
        .eq("profile_id", profileId)
        .order("paid_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as MayorSalaryPayment[];
    },
    enabled: !!profileId,
  });
}

export function useProposeMotion() {
  const queryClient = useQueryClient();
  const { profileId } = useActiveProfile();
  const { data: seat } = useMyMayorSeat();

  return useMutation({
    mutationFn: async (input: {
      title: string;
      body: string;
      motion_type: MotionType;
      payload?: Record<string, unknown>;
      voting_days?: number;
    }) => {
      if (!profileId) throw new Error("Sign in first");
      if (!seat?.id) throw new Error("Only sitting mayors may propose motions");

      const closesAt = new Date(Date.now() + (input.voting_days ?? 3) * 86_400_000).toISOString();

      const { data, error } = await supabase
        .from("world_parliament_motions")
        .insert({
          proposer_mayor_id: seat.id,
          proposer_profile_id: profileId,
          title: input.title,
          body: input.body,
          motion_type: input.motion_type,
          payload: input.payload ?? {},
          voting_closes_at: closesAt,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ParliamentMotion;
    },
    onSuccess: () => {
      toast.success("Motion tabled");
      queryClient.invalidateQueries({ queryKey: ["parliament-motions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCastParliamentVote() {
  const queryClient = useQueryClient();
  const { profileId } = useActiveProfile();
  const { data: seat } = useMyMayorSeat();

  return useMutation({
    mutationFn: async ({ motionId, vote }: { motionId: string; vote: Vote }) => {
      if (!profileId) throw new Error("Sign in first");
      if (!seat?.id) throw new Error("Only sitting mayors may vote");

      const { error } = await supabase
        .from("world_parliament_votes")
        .insert({
          motion_id: motionId,
          mayor_id: seat.id,
          voter_profile_id: profileId,
          vote,
        });
      if (error) {
        if (error.code === "23505") throw new Error("You've already voted on this motion");
        throw error;
      }
    },
    onSuccess: (_, vars) => {
      toast.success("Vote recorded");
      queryClient.invalidateQueries({ queryKey: ["parliament-motions"] });
      queryClient.invalidateQueries({ queryKey: ["parliament-votes", vars.motionId] });
      queryClient.invalidateQueries({ queryKey: ["parliament-motion", vars.motionId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
