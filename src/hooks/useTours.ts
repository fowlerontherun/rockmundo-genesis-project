import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { listTours, createTour, updateTour, deleteTour } from "@/lib/api/tours";
import type { CreateTourInput, UpdateTourInput } from "@/lib/api/tours";

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
      const { data, error } = await supabase
        .from("venues")
        .select("*, city:cities(*)")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const createTourMutation = useMutation({
    mutationFn: (input: CreateTourInput) => createTour(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tours"] });
      toast({
        title: "Tour created",
        description: "Your tour has been created successfully!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create tour",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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
  });

  const deleteTourMutation = useMutation({
    mutationFn: (id: string) => deleteTour(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tours"] });
      toast({
        title: "Tour deleted",
        description: "The tour has been removed.",
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
      queryClient.invalidateQueries({ queryKey: ["tours"] });
      queryClient.invalidateQueries({ queryKey: ["tour-gigs"] });
      queryClient.invalidateQueries({ queryKey: ["gigs"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] });
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
    createTour: createTourMutation,
    updateTour: updateTourMutation,
    deleteTour: deleteTourMutation,
    cancelTour: cancelTourMutation,
  };
};
