import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CancelRecordingSessionInput {
  sessionId: string;
  reason?: string;
}

interface CancelRecordingResult {
  sessionId: string;
  refunded: number;
  paymentSource?: "band" | "personal";
}

const readableCancelError = (message: string) => {
  if (message.includes("recording_already_started")) {
    return "This recording session has already started and can no longer be cancelled or rescheduled.";
  }
  if (message.includes("recording_not_cancellable")) {
    return "Only recording sessions that have not started yet can be cancelled.";
  }
  if (message.includes("recording_not_owned_by_caller") || message.includes("not_band_member")) {
    return "You do not have permission to cancel this recording session.";
  }
  if (message.includes("booking_payment_not_found")) {
    return "The payment record for this session could not be found. No refund was attempted.";
  }
  if (message.includes("recording_not_found")) {
    return "Recording session not found.";
  }
  return message || "Unable to cancel the recording session.";
};

/**
 * Cancels a future recording through the server-authoritative booking refund
 * path. This releases the studio slot, clears diary blocks for everyone involved
 * and refunds the original payment source exactly once.
 */
export const useCancelRecordingSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, reason }: CancelRecordingSessionInput): Promise<CancelRecordingResult> => {
      const idempotencyKey = `recording-cancel:${sessionId}`;
      const { data, error } = await (supabase as any).rpc("cancel_recording_session_atomic", {
        p_recording_id: sessionId,
        p_reason: reason ?? "cancelled_by_player",
        p_idempotency_key: idempotencyKey,
      });

      if (error) {
        throw new Error(readableCancelError(error.message || ""));
      }

      const refund = data?.refund ?? {};
      return {
        sessionId,
        refunded: Number(refund.amountMinor ?? 0) / 100,
        paymentSource: refund.paymentSource,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["recording-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["studio-availability"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] });
      queryClient.invalidateQueries({ queryKey: ["week-scheduled-activities"] });
      queryClient.invalidateQueries({ queryKey: ["user-cash-balance"] });
      queryClient.invalidateQueries({ queryKey: ["band-payment-source-band"] });
      queryClient.invalidateQueries({ queryKey: ["band-payment-source-profile"] });

      toast.success(
        result.refunded > 0
          ? `Session cancelled — $${result.refunded.toLocaleString()} refunded`
          : "Recording session cancelled",
      );
    },
    onError: (error: Error) => {
      toast.error(`Could not cancel session: ${error.message}`);
    },
  });
};
