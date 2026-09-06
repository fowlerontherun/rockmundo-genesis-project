import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";
import type { AddictionRecord, RecoveryProgram } from "@/utils/addictionSystem";

export function useAddictions() {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  const addictionsQuery = useQuery({
    queryKey: ["addictions", profileId],
    queryFn: async () => {
      if (!profileId) return [];

      const { error: processError } = await (supabase as any).rpc(
        "process_addiction_recovery",
        { p_profile_id: profileId },
      );
      if (processError) throw processError;

      const { data, error } = await (supabase as any)
        .from("player_addictions")
        .select("*")
        .eq("profile_id", profileId)
        .in("status", ["active", "recovering", "relapsed"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as AddictionRecord[];
    },
    enabled: !!profileId,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["addictions", profileId] });
    queryClient.invalidateQueries({ queryKey: ["substance-state", profileId] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    queryClient.invalidateQueries({ queryKey: ["game-data"] });
  };

  const startRecoveryMutation = useMutation({
    mutationFn: async ({ addictionId, program }: { addictionId: string; program: RecoveryProgram }) => {
      if (!profileId) throw new Error("Not authenticated");
      const { data, error } = await (supabase as any).rpc("start_addiction_recovery", {
        p_profile_id: profileId,
        p_addiction_id: addictionId,
        p_program: program,
      });
      if (error) throw error;
      if (!data?.ok) {
        if (data?.reason === "insufficient_cash") throw new Error(`You need $${data.cost ?? 0} for this recovery programme.`);
        if (data?.reason === "schedule_conflict") throw new Error("Clear conflicting activities before entering rehab.");
        throw new Error("Unable to start recovery right now.");
      }
      return data;
    },
    onSuccess: (data) => {
      refresh();
      toast.success(data.program === "rehab" ? "Rehab booked. Your schedule is now blocked for recovery." : "Recovery programme started.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const therapySessionMutation = useMutation({
    mutationFn: async (addictionId: string) => {
      if (!profileId) throw new Error("Not authenticated");
      const { data, error } = await (supabase as any).rpc("attend_addiction_therapy", {
        p_profile_id: profileId,
        p_addiction_id: addictionId,
      });
      if (error) throw error;
      if (!data?.ok) {
        if (data?.reason === "insufficient_cash") throw new Error("You need $100 for a therapy session.");
        throw new Error("Therapy is not available for this addiction right now.");
      }
      return data;
    },
    onSuccess: (data) => {
      refresh();
      toast.success(data.recovered ? "Recovery complete. Staying clean will protect the progress." : `Therapy complete. Severity reduced to ${data.severity}.`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addictions = addictionsQuery.data || [];

  return {
    addictions,
    isLoading: addictionsQuery.isLoading,
    hasActiveAddiction: addictions.length > 0,
    startRecovery: startRecoveryMutation.mutate,
    isStartingRecovery: startRecoveryMutation.isPending,
    attendTherapy: therapySessionMutation.mutate,
    isAttendingTherapy: therapySessionMutation.isPending,
  };
}
