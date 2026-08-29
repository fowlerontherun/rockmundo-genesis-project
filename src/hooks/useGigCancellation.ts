import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatMerchCurrency } from "@/lib/api/merch";

export type GigCancellationTier =
  | "fourteen_days_plus"
  | "seven_to_fourteen_days"
  | "three_to_seven_days"
  | "one_to_three_days"
  | "under_twenty_four_hours";

export interface GigCancellationPreview {
  gig_id: string;
  band_id: string;
  venue_id: string;
  venue_name: string;
  scheduled_start: string;
  status: string;
  can_cancel: boolean;
  policy_version: string;
  tier: GigCancellationTier;
  notice_hours: number;
  booking_fee: number;
  refund_percentage: number;
  refund_amount: number;
  non_refundable_amount: number;
  fame_penalty: number;
  fan_sentiment_penalty: number;
  reputation_penalty: number;
}

export interface GigCancellationResult extends GigCancellationPreview {
  already_cancelled: boolean;
  cancelled_at: string;
  cancellation_reason: string;
  financial_transaction_id: string | null;
  used_canonical_ledger: boolean;
  band_balance: number;
  band_fame: number;
  band_global_fame: number;
  band_fan_sentiment: number;
  band_reputation: number;
}

interface GigCancellationErrorLike {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

const cancellationErrors: Array<[string, string]> = [
  ["gig_cancellation_forbidden", "You do not have permission to cancel shows for this band."],
  ["gig_cancellation_not_found", "This show could not be found."],
  ["gig_cancellation_not_cancellable", "This show has already started or can no longer be cancelled."],
  ["gig_cancellation_finance_unavailable", "The refund service is temporarily unavailable. Nothing was cancelled or charged."],
  ["gig_cancellation_finance_invalid", "The original booking payment could not be verified. Nothing was cancelled or refunded."],
  ["gig_cancellation_profile_missing", "Your active player profile could not be resolved. Reload and try again."],
];

export function getGigCancellationPlayerError(error: GigCancellationErrorLike): string {
  const diagnostic = [error.message, error.details, error.hint].filter(Boolean).join(" ");
  const match = cancellationErrors.find(([key]) => diagnostic.includes(key));
  if (match) return match[1];

  if (error.code === "42883" || error.code === "PGRST202") {
    return "The show cancellation database update is not installed yet. Please contact an administrator.";
  }

  return "The show could not be cancelled. No partial refund or penalty was applied.";
}

export function useGigCancellation() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const previewCancellation = useCallback(async (gigId: string): Promise<GigCancellationPreview> => {
    const { data, error } = await supabase.rpc("preview_gig_cancellation", {
      p_gig_id: gigId,
    });

    if (error) throw error;
    if (!data || typeof data !== "object") {
      throw new Error("gig_cancellation_invalid_preview");
    }

    return data as unknown as GigCancellationPreview;
  }, []);

  const cancelGig = useCallback(async (
    gigId: string,
    reason = "Cancelled by band",
  ): Promise<GigCancellationResult | null> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc("cancel_gig", {
        p_gig_id: gigId,
        p_reason: reason,
      });
      if (error) throw error;
      if (!data || typeof data !== "object") {
        throw new Error("gig_cancellation_invalid_response");
      }

      const result = data as unknown as GigCancellationResult;
      const careerPenalties = [
        result.fame_penalty > 0 ? `${result.fame_penalty} fame` : null,
        result.fan_sentiment_penalty > 0 ? `${result.fan_sentiment_penalty} fan sentiment` : null,
        result.reputation_penalty > 0 ? `${result.reputation_penalty} reputation` : null,
      ].filter(Boolean);

      toast({
        title: result.already_cancelled ? "Show already cancelled" : "Show cancelled",
        description: result.already_cancelled
          ? "This cancellation had already been processed. No duplicate refund or penalty was applied."
          : [
              result.refund_amount > 0
                ? `${formatMerchCurrency(result.refund_amount)} booking-fee refund (${result.refund_percentage}%).`
                : "The booking fee was not refunded.",
              careerPenalties.length > 0
                ? `Penalty: ${careerPenalties.join(", ")}.`
                : "No career penalty was applied.",
            ].join(" "),
        variant: careerPenalties.length > 0 ? "destructive" : "default",
      });

      return result;
    } catch (error) {
      console.error("Error cancelling gig:", error);
      toast({
        title: "Cancellation failed",
        description: getGigCancellationPlayerError(error as GigCancellationErrorLike),
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return {
    isLoading,
    previewCancellation,
    cancelGig,
  };
}
