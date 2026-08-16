import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { listTours, rescheduleTour, updateTour } from "@/lib/api/tours";
import type { UpdateTourInput } from "@/lib/api/tours";

export const useTours = (bandId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tours, isLoading: toursLoading } = useQuery({
    queryKey: ["tours", bandId],
    queryFn: () => listTours(bandId),
  });

  const { data: tourGigs, isLoading: gigsLoading } = useQuery({
    queryKey: ["tour-gigs", bandId],
    queryFn: async () => {
      if (!bandId) return [];

      const { data, error } = await supabase
        .from("gigs")
        .select(`
          *,
          venue:venues(*),
          setlist:setlists(*)
        `)
        .eq("band_id", bandId)
        .not("tour_id", "is", null)
        .order("scheduled_date", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!bandId,
  });

  const { data: venues } = useQuery({
    queryKey: ["tour-venues"],
    queryFn: async () => {
      return await fetchAllVenues<any>("*, city:cities(*)", { column: "name", ascending: true });
    },
  });

  const invalidateTourSchedule = () => {
    queryClient.invalidateQueries({ queryKey: ["tours"] });
    queryClient.invalidateQueries({ queryKey: ["tour-gigs"] });
    queryClient.invalidateQueries({ queryKey: ["gigs"] });
    queryClient.invalidateQueries({ queryKey: ["tour-venues"] });
    queryClient.invalidateQueries({ queryKey: ["tour-travel-legs"] });
    queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] });
    queryClient.invalidateQueries({ queryKey: ["travel-status"] });
    queryClient.invalidateQueries({ queryKey: ["travel-plans"] });
  };

  const updateTourMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTourInput }) =>
      updateTour(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tours"] });
      toast({
        title: "Tour updated",
        description: "Tour details have been updated.",
      });
    },
    onError: (error: Error) => {
      const description = error.message.includes("tour_update_forbidden")
        ? "You do not have permission to update this tour."
        : error.message.includes("tour_update_status_locked")
          ? "Completed and cancelled tours cannot be edited."
          : error.message.includes("tour_update_name_invalid")
            ? "Enter a tour name between 1 and 120 characters."
            : "The tour could not be updated.";

      toast({
        title: "Failed to update tour",
        description,
        variant: "destructive",
      });
    },
  });

  const rescheduleTourMutation = useMutation({
    mutationFn: ({ id, newStartDate, requestId }: { id: string; newStartDate: string; requestId?: string }) =>
      rescheduleTour(id, newStartDate, requestId),
    onSuccess: (result) => {
      invalidateTourSchedule();
      toast({
        title: result.already_rescheduled ? "Tour already rescheduled" : "Tour rescheduled",
        description: result.already_rescheduled
          ? "This rescheduling request had already been applied."
          : `${result.gigs_moved ?? 0} gigs and ${result.travel_legs_moved ?? 0} travel legs were moved together.`,
      });
    },
    onError: (error: Error) => {
      const description = error.message.includes("tour_reschedule_forbidden")
        ? "You do not have permission to reschedule this tour."
        : error.message.includes("tour_reschedule_state_invalid") || error.message.includes("tour_reschedule_started")
          ? "Only tours that have not started can be rescheduled."
          : error.message.includes("tour_reschedule_past_date")
            ? "The new tour start date cannot be in the past."
            : error.message.includes("tour_reschedule_band_conflict")
              ? "The band already has another booking during the proposed dates."
              : error.message.includes("tour_reschedule_venue_conflict")
                ? "A venue is unavailable during the proposed dates."
                : "The tour could not be rescheduled. No dates were changed.";

      toast({
        title: "Failed to reschedule tour",
        description,
        variant: "destructive",
      });
    },
  });

  const cancelTourMutation = useMutation({
    mutationFn: async (tourId: string) => {
      const { data, error } = await (supabase.rpc as any)("cancel_tour", {
        p_tour_id: tourId,
      });

      if (error) throw error;
      return data as {
        tour_id: string;
        already_cancelled?: boolean;
        same_day?: boolean;
        refund_amount?: number;
      };
    },
    onSuccess: (result) => {
      invalidateTourSchedule();
      queryClient.invalidateQueries({ queryKey: ["band-for-tour"] });

      const refundAmount = Number(result.refund_amount ?? 0);
      toast({
        title: result.already_cancelled ? "Tour already cancelled" : "Tour cancelled",
        description: refundAmount > 0
          ? `Full refund of £${refundAmount.toLocaleString("en-GB")} applied (same-day cancellation).`
          : "Tour has been cancelled. No refund is available after the booking day.",
      });
    },
    onError: (error: Error) => {
      console.error("Failed to cancel tour:", error);
      const description = error.message.includes("tour_cancel_forbidden")
        ? "You do not have permission to cancel this tour."
        : error.message.includes("tour_cancel_not_found")
          ? "This tour no longer exists."
          : "The tour could not be cancelled. No partial cancellation or refund was applied.";

      toast({
        title: "Failed to cancel tour",
        description,
        variant: "destructive",
      });
    },
  });

  return {
    tours,
    tourGigs,
    venues,
    toursLoading,
    gigsLoading,
    updateTour: updateTourMutation,
    rescheduleTour: rescheduleTourMutation,
    cancelTour: cancelTourMutation,
  };
};
