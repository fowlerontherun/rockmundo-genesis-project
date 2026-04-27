import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { asAny } from "@/lib/type-helpers";
import { toast } from "sonner";

export type ChildInteractionType =
  | "feed"
  | "sleep"
  | "play"
  | "teach_skill"
  | "outing"
  | "comfort";

export interface ChildInteraction {
  id: string;
  child_id: string;
  parent_profile_id: string;
  interaction_type: string;
  effects: Record<string, unknown>;
  notes: string | null;
  created_at: string;
}

export function useChildInteractions(childId: string | undefined) {
  return useQuery({
    queryKey: ["child-interactions", childId],
    enabled: !!childId,
    queryFn: async (): Promise<ChildInteraction[]> => {
      if (!childId) return [];
      const { data, error } = await supabase
        .from(asAny("child_interactions"))
        .select("*")
        .eq("child_id", childId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as ChildInteraction[];
    },
  });
}

export function useApplyChildInteraction(childId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { type: ChildInteractionType; notes?: string }) => {
      if (!childId) throw new Error("Missing child id");
      const { data, error } = await (supabase as any).rpc("apply_child_interaction", {
        p_child_id: childId,
        p_interaction_type: params.type,
        p_notes: params.notes ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Interaction logged");
      qc.invalidateQueries({ queryKey: ["child-interactions", childId] });
      qc.invalidateQueries({ queryKey: ["player-children"] });
      qc.invalidateQueries({ queryKey: ["player-child", childId] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to log interaction");
    },
  });
}

export function usePlayerChild(childId: string | undefined) {
  return useQuery({
    queryKey: ["player-child", childId],
    enabled: !!childId,
    queryFn: async () => {
      if (!childId) return null;
      const { data, error } = await supabase
        .from(asAny("player_children"))
        .select("*")
        .eq("id", childId)
        .single();
      if (error) throw error;
      return data as any;
    },
  });
}
