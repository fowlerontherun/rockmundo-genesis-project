import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { toast } from "sonner";
import type { AddictionRecord, RecoveryProgram } from "@/utils/addictionSystem";
import { getRecoveryProgramDetails } from "@/utils/addictionSystem";

export function useAddictions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch active/recovering addictions
  const { data: addictions, isLoading } = useQuery({
    queryKey: ["addictions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("player_addictions")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["active", "recovering", "relapsed"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as AddictionRecord[];
    },
    enabled: !!user?.id,
  });

  // Start a recovery program
  const startRecoveryMutation = useMutation({
    mutationFn: async ({ addictionId, program }: { addictionId: string; program: RecoveryProgram }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const details = getRecoveryProgramDetails(program);

      // Check cost for therapy
      if (program === "therapy") {
        const { data: profile } = await supabase
          .from("profiles")
          .select("cash")
          .eq("user_id", user.id)
          .single();
        if ((profile?.cash ?? 0) < details.costPerSession) {
          throw new Error(`Need $${details.costPerSession} for a therapy session`);
        }
      }

      // Check cost for rehab
      if (program === "rehab") {
        const rehabDetails = details as { costRange: { min: number; max: number }; durationDays: { min: number; max: number } };
        const { data: profile } = await supabase
          .from("profiles")
          .select("cash")
          .eq("user_id", user.id)
          .single();
        const rehabCost = rehabDetails.costRange.min + Math.floor(Math.random() * (rehabDetails.costRange.max - rehabDetails.costRange.min));
        if ((profile?.cash ?? 0) < rehabCost) {
          throw new Error(`Need $${rehabCost} for rehab`);
        }
        // Deduct cost
        await supabase.from("profiles").update({ cash: (profile?.cash ?? 0) - rehabCost }).eq("user_id", user.id);

        // Create blocking scheduled activity for rehab
        const rehabDays = rehabDetails.durationDays.min + Math.floor(Math.random() * (rehabDetails.durationDays.max - rehabDetails.durationDays.min));
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + rehabDays);

        await (supabase as any).from("player_scheduled_activities").insert({
          user_id: user.id,
          activity_type: "rehab",
          scheduled_start: new Date().toISOString(),
          scheduled_end: endDate.toISOString(),
          title: "Rehabilitation Program",
          description: `${rehabDays}-day residential rehab program`,
          status: "in_progress",
        });
      }

      const { error } = await supabase
        .from("player_addictions")
        .update({
          status: "recovering",
          recovery_program: program,
          recovery_started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", addictionId);

      if (error) throw error;
      return { program };
    },
    onSuccess: ({ program }) => {
      queryClient.invalidateQueries({ queryKey: ["addictions"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success(`Started ${program} recovery program`);
    },
    onError: (err) => toast.error(err.message),
  });

  // Attend a therapy session (reduces severity)
  const therapySessionMutation = useMutation({
    mutationFn: async (addictionId: string) => {
      if (!user?.id) throw new Error("Not authenticated");

      const addiction = addictions?.find(a => a.id === addictionId);
      if (!addiction) throw new Error("Addiction not found");
      if (addiction.recovery_program !== "therapy") throw new Error("Not in therapy program");

      const { data: profile } = await supabase
        .from("profiles")
        .select("cash")
        .eq("user_id", user.id)
        .single();

      if ((profile?.cash ?? 0) < 100) throw new Error("Need $100 for therapy session");

      const reduction = 5 + Math.floor(Math.random() * 6); // 5-10
      const newSeverity = Math.max(0, addiction.severity - reduction);

      await supabase.from("profiles").update({ cash: (profile?.cash ?? 0) - 100 }).eq("user_id", user.id);

      const updates: any = {
        severity: newSeverity,
        days_clean: addiction.days_clean + 1,
        updated_at: new Date().toISOString(),
      };

      if (newSeverity === 0) {
        updates.status = "recovered";
        updates.recovered_at = new Date().toISOString();
      }

      await supabase.from("player_addictions").update(updates).eq("id", addictionId);

      return { reduction, newSeverity };
    },
    onSuccess: ({ reduction, newSeverity }) => {
      queryClient.invalidateQueries({ queryKey: ["addictions"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      if (newSeverity === 0) {
        toast.success("You've recovered! Stay vigilant.");
      } else {
        toast.success(`Therapy session complete. Severity reduced by ${reduction} to ${newSeverity}`);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const hasActiveAddiction = (addictions?.length ?? 0) > 0;

  return {
    addictions: addictions || [],
    isLoading,
    hasActiveAddiction,
    startRecovery: startRecoveryMutation.mutate,
    isStartingRecovery: startRecoveryMutation.isPending,
    attendTherapy: therapySessionMutation.mutate,
    isAttendingTherapy: therapySessionMutation.isPending,
  };
}
