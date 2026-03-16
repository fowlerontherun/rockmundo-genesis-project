import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";
import {
  calculateRecoveryTime,
  aggregateConditionEffects,
  getConditionDefinition,
  type ConditionEffects,
  type TreatmentType,
} from "@/utils/conditionSystem";

export interface PlayerCondition {
  id: string;
  user_id: string;
  profile_id?: string;
  condition_type: string;
  condition_name: string;
  severity: number;
  status: string;
  cause: string | null;
  effects: ConditionEffects | null;
  treatment_type: string | null;
  treatment_started_at: string | null;
  estimated_recovery_at: string | null;
  recovered_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useConditions() {
  const { profileId, userId } = useActiveProfile();
  const queryClient = useQueryClient();

  const { data: conditions = [], isLoading } = useQuery({
    queryKey: ["player-conditions", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await (supabase as any)
        .from("player_conditions")
        .select("*")
        .eq("user_id", userId)
        .in("status", ["active", "treating"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PlayerCondition[];
    },
    enabled: !!profileId,
  });

  const activeConditions = conditions.filter((c) => c.status === "active" || c.status === "treating");

  const aggregatedEffects = aggregateConditionEffects(
    activeConditions.map((c) => ({
      condition_name: c.condition_name,
      severity: c.severity,
      effects: c.effects,
    }))
  );

  const treatMutation = useMutation({
    mutationFn: async ({ conditionId, treatmentType }: { conditionId: string; treatmentType: TreatmentType }) => {
      if (!profileId) throw new Error("Not authenticated");

      const condition = conditions.find((c) => c.id === conditionId);
      if (!condition) throw new Error("Condition not found");

      const def = getConditionDefinition(condition.condition_name);
      const cost = def?.treatmentCosts[treatmentType] || 0;

      if (cost > 0) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("cash")
          .eq("id", profileId)
          .single();

        if (!profile || profile.cash < cost) {
          throw new Error(`Not enough cash ($${cost} needed)`);
        }

        await supabase
          .from("profiles")
          .update({ cash: profile.cash - cost })
          .eq("id", profileId);
      }

      const recoveryHours = calculateRecoveryTime(condition.condition_name, condition.severity, treatmentType);
      const recoveryAt = new Date();
      recoveryAt.setHours(recoveryAt.getHours() + recoveryHours);

      const { error } = await (supabase as any)
        .from("player_conditions")
        .update({
          status: "treating",
          treatment_type: treatmentType,
          treatment_started_at: new Date().toISOString(),
          estimated_recovery_at: recoveryAt.toISOString(),
        })
        .eq("id", conditionId);

      if (error) throw error;
      return { treatmentType, cost, recoveryHours, conditionName: def?.label || condition.condition_name };
    },
    onSuccess: ({ treatmentType, cost, recoveryHours, conditionName }) => {
      queryClient.invalidateQueries({ queryKey: ["player-conditions"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      const days = Math.round(recoveryHours / 24 * 10) / 10;
      toast.success(`Started ${treatmentType} for ${conditionName}. Recovery in ~${days} days.${cost > 0 ? ` Cost: $${cost}` : ""}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const checkRecoveryMutation = useMutation({
    mutationFn: async () => {
      if (!profileId) return;
      const now = new Date().toISOString();
      const treatingConditions = conditions.filter(
        (c) => c.status === "treating" && c.estimated_recovery_at && c.estimated_recovery_at <= now
      );

      for (const condition of treatingConditions) {
        await (supabase as any)
          .from("player_conditions")
          .update({ status: "recovered", recovered_at: now })
          .eq("id", condition.id);
      }

      return treatingConditions.length;
    },
    onSuccess: (count) => {
      if (count && count > 0) {
        queryClient.invalidateQueries({ queryKey: ["player-conditions"] });
        toast.success(`${count} condition(s) recovered!`);
      }
    },
  });

  return {
    conditions: activeConditions,
    allConditions: conditions,
    aggregatedEffects,
    isLoading,
    treatCondition: treatMutation.mutate,
    isTreating: treatMutation.isPending,
    checkRecovery: checkRecoveryMutation.mutate,
    hasBlockingCondition: (type: string) => {
      if (aggregatedEffects.blocks_gigs) return true;
      if (type === "guitar" && aggregatedEffects.blocks_guitar_gigs) return true;
      if (type === "singing" && aggregatedEffects.blocks_singing) return true;
      if (type === "travel" && aggregatedEffects.blocks_travel) return true;
      return false;
    },
  };
}
