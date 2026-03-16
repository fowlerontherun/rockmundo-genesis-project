import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";
import type { AddictionRecord, RecoveryProgram } from "@/utils/addictionSystem";
import { getRecoveryProgramDetails } from "@/utils/addictionSystem";

export function useAddictions() {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  const { data: addictions, isLoading } = useQuery({
    queryKey: ["addictions", profileId],
    queryFn: async () => {
      if (!profileId) return [];
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

  const startRecoveryMutation = useMutation({
    mutationFn: async ({ addictionId, program }: { addictionId: string; program: RecoveryProgram }) => {
      if (!profileId) throw new Error("Not authenticated");

      const details = getRecoveryProgramDetails(program);

      if (program === "therapy") {
        const { data: profile } = await supabase
          .from("profiles")
          .select("cash")
          .eq("id", profileId)
          .single();
        if ((profile?.cash ?? 0) < details.costPerSession) {
          throw new Error(`Need $${details.costPerSession} for a therapy session`);
        }
      }

      if (program === "rehab") {
        const rehabDetails = details as { costRange: { min: number; max: number }; durationDays: { min: number; max: number } };
        const { data: profile } = await supabase
          .from("profiles")
          .select("cash")
          .eq("id", profileId)
          .single();
        const rehabCost = rehabDetails.costRange.min + Math.floor(Math.random() * (rehabDetails.costRange.max - rehabDetails.costRange.min));
        if ((profile?.cash ?? 0) < rehabCost) {
          throw new Error(`Need $${rehabCost} for rehab`);
        }
        await supabase.from("profiles").update({ cash: (profile?.cash ?? 0) - rehabCost }).eq("id", profileId);

        const rehabDays = rehabDetails.durationDays.min + Math.floor(Math.random() * (rehabDetails.durationDays.max - rehabDetails.durationDays.min));
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + rehabDays);

        await (supabase as any).from("player_scheduled_activities").insert({
          user_id: profileId,
          profile_id: profileId,
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

  const therapySessionMutation = useMutation({
    mutationFn: async (addictionId: string) => {
      if (!profileId) throw new Error("Not authenticated");

      const addiction = addictions?.find(a => a.id === addictionId);
      if (!addiction) throw new Error("Addiction not found");
      if (addiction.recovery_program !== "therapy") throw new Error("Not in therapy program");

      const { data: profile } = await supabase
        .from("profiles")
        .select("cash")
        .eq("id", profileId)
        .single();

      if ((profile?.cash ?? 0) < 100) throw new Error("Need $100 for therapy session");

      const reduction = 5 + Math.floor(Math.random() * 6);
      const newSeverity = Math.max(0, addiction.severity - reduction);

      await supabase.from("profiles").update({ cash: (profile?.cash ?? 0) - 100 }).eq("id", profileId);

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
