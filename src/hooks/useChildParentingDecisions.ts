import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ParentingDecisionType =
  | "upbringing_focus"
  | "schooling_focus"
  | "mentor_focus"
  | "life_event_choice";

export type ParentingDecisionStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "superseded"
  | "applied";

export interface ChildParentingDecision {
  id: string;
  child_id: string;
  proposed_by_profile_id: string;
  decision_type: ParentingDecisionType;
  proposal: Record<string, unknown>;
  status: ParentingDecisionStatus;
  responded_by_profile_id: string | null;
  response_note: string | null;
  created_at: string;
  responded_at: string | null;
  applied_at: string | null;
}

export function useChildParentingDecisions(childId?: string) {
  return useQuery({
    queryKey: ["child-parenting-decisions", childId],
    enabled: Boolean(childId),
    queryFn: async (): Promise<ChildParentingDecision[]> => {
      const { data, error } = await (supabase as any)
        .from("child_parenting_decisions")
        .select("id,child_id,proposed_by_profile_id,decision_type,proposal,status,responded_by_profile_id,response_note,created_at,responded_at,applied_at")
        .eq("child_id", childId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ChildParentingDecision[];
    },
  });
}

export function useProposeChildParentingDecision(childId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { decisionType: ParentingDecisionType; proposal: Record<string, unknown> }) => {
      if (!childId) throw new Error("Child is required");
      const { data, error } = await (supabase as any).rpc("propose_child_parenting_decision", {
        p_child_id: childId,
        p_decision_type: input.decisionType,
        p_proposal: input.proposal,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as ChildParentingDecision;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["child-parenting-decisions", childId] });
      await qc.invalidateQueries({ queryKey: ["player-child", childId] });
      await qc.invalidateQueries({ queryKey: ["player-children"] });
    },
  });
}

export function useRespondChildParentingDecision(childId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { decisionId: string; accept: boolean; note?: string }) => {
      const { data, error } = await (supabase as any).rpc("respond_child_parenting_decision", {
        p_decision_id: input.decisionId,
        p_accept: input.accept,
        p_note: input.note ?? null,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as ChildParentingDecision;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["child-parenting-decisions", childId] });
      await qc.invalidateQueries({ queryKey: ["player-child", childId] });
      await qc.invalidateQueries({ queryKey: ["player-children"] });
    },
  });
}
