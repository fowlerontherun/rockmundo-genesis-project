import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface CancelTourResult {
  tour_id: string;
  already_cancelled?: boolean;
  same_day?: boolean;
  refund_amount?: number;
}

const getCancellationErrorMessage = (error: Error): string => {
  if (error.message.includes("tour_cancel_forbidden")) {
    return "You do not have permission to cancel this tour.";
  }
  if (error.message.includes("tour_cancel_not_found")) {
    return "This tour no longer exists.";
  }
  return "The tour could not be cancelled. No partial cancellation or refund was applied.";
};

export const useTourCancellation = () => {
  const queryClient = useQueryClient();

  const cancelTour = useMutation({
    mutationFn: async (tourId: string): Promise<CancelTourResult> => {
      const { data, error } = await (supabase.rpc as any)("cancel_tour", {
        p_tour_id: tourId,
      });

      if (error) throw error;
      if (!data) throw new Error("tour_cancel_empty_response");
      return data as CancelTourResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["my-tours"] });
      queryClient.invalidateQueries({ queryKey: ["tours"] });
      queryClient.invalidateQueries({ queryKey: ["tour-gigs"] });
      queryClient.invalidateQueries({ queryKey: ["tour-venues"] });
      queryClient.invalidateQueries({ queryKey: ["tour-travel-legs"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] });
      queryClient.invalidateQueries({ queryKey: ["band-for-tour"] });

      const refundAmount = Number(result.refund_amount ?? 0);
      if (result.already_cancelled) {
        toast.info("This tour was already cancelled.");
      } else if (refundAmount > 0) {
        toast.success(
          `Tour cancelled. £${refundAmount.toLocaleString("en-GB")} was refunded.`,
        );
      } else {
        toast.success("Tour cancelled. No refund is available after the booking day.");
      }
    },
    onError: (error: Error) => {
      console.error("Failed to cancel tour:", error);
      toast.error(getCancellationErrorMessage(error));
    },
  });

  return { cancelTour };
};
