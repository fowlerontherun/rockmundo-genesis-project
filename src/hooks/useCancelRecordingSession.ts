import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CancelRecordingSessionInput {
  sessionId: string;
  reason?: string;
}

/**
 * Cancels a scheduled (not yet started) recording session, frees the studio
 * slot, removes the diary blocks for everyone involved and refunds the cost to
 * whichever balance paid for it.
 */
export const useCancelRecordingSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, reason }: CancelRecordingSessionInput) => {
      const { data: session, error: fetchError } = await (supabase as any)
        .from("recording_sessions")
        .select("id, status, band_id, profile_id, user_id, total_cost, scheduled_start")
        .eq("id", sessionId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!session) throw new Error("Recording session not found.");
      if (session.status !== "scheduled") {
        throw new Error("Only sessions that have not started yet can be cancelled.");
      }

      const totalCost = Number(session.total_cost ?? 0);

      // Refund whichever balance paid for the session.
      if (totalCost > 0) {
        if (session.band_id) {
          await (supabase as any).from("band_earnings").insert({
            band_id: session.band_id,
            amount: Math.round(totalCost),
            source: "recording",
            description: "Refund for cancelled recording session",
            earned_by_user_id: session.user_id,
            metadata: { recording_session_id: session.id, refund: true },
          });
        } else if (session.profile_id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, cash")
            .eq("id", session.profile_id)
            .maybeSingle();

          if (profile) {
            await supabase
              .from("profiles")
              .update({ cash: Number(profile.cash ?? 0) + Math.round(totalCost) })
              .eq("id", profile.id);
          }
        }
      }

      // Release the diary blocks created for this session.
      await (supabase as any)
        .from("player_scheduled_activities")
        .update({ status: "cancelled" })
        .eq("linked_recording_id", sessionId)
        .neq("status", "completed");

      const { error: updateError } = await (supabase as any)
        .from("recording_sessions")
        .update({ status: "cancelled" })
        .eq("id", sessionId);

      if (updateError) throw updateError;

      return { sessionId, refunded: totalCost, reason: reason ?? null };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["recording-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["studio-availability"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] });
      queryClient.invalidateQueries({ queryKey: ["week-scheduled-activities"] });
      queryClient.invalidateQueries({ queryKey: ["user-cash-balance"] });
      toast.success(
        result.refunded > 0
          ? `Session cancelled — £${result.refunded.toLocaleString()} refunded`
          : "Recording session cancelled",
      );
    },
    onError: (error: Error) => {
      toast.error(`Could not cancel session: ${error.message}`);
    },
  });
};
