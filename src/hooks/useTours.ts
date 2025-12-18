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
      // Fetch tour details
      const { data: tour, error: fetchError } = await supabase
        .from("tours")
        .select("*, bands:band_id(band_balance)")
        .eq("id", tourId)
        .single();

      if (fetchError || !tour) throw new Error("Tour not found");

      // Check if same-day cancellation for full refund
      const createdAt = new Date(tour.created_at);
      const now = new Date();
      const isSameDay = createdAt.toDateString() === now.toDateString();
      const refundAmount = isSameDay ? (tour.total_upfront_cost || 0) : 0;

      // Delete associated gigs
      await supabase
        .from("gigs")
        .delete()
        .eq("tour_id", tourId);

      // Delete associated tour venues
      await supabase
        .from("tour_venues")
        .delete()
        .eq("tour_id", tourId);

      // Delete associated travel legs
      await supabase
        .from("tour_travel_legs")
        .delete()
        .eq("tour_id", tourId);

      // Refund band if same-day
      if (refundAmount > 0 && tour.band_id) {
        const currentBalance = tour.bands?.band_balance || 0;
        await supabase
          .from("bands")
          .update({ band_balance: currentBalance + refundAmount })
          .eq("id", tour.band_id);
      }

      // Delete the tour
      const { error: deleteError } = await supabase
        .from("tours")
        .delete()
        .eq("id", tourId);

      if (deleteError) throw deleteError;

      return { refundAmount, isSameDay };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["tours"] });
      queryClient.invalidateQueries({ queryKey: ["tour-gigs"] });
      queryClient.invalidateQueries({ queryKey: ["band-for-tour"] });
      toast({
        title: "Tour cancelled",
        description: result.refundAmount > 0 
          ? `Full refund of $${result.refundAmount.toLocaleString()} applied (same-day cancellation).`
          : "Tour has been cancelled. No refund available after booking day.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to cancel tour",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addGigToTour = useMutation({
    mutationFn: async (params: {
      tourId: string;
      venueId: string;
      bandId: string;
      scheduledDate: string;
      setlistId?: string;
    }) => {
      const { data, error } = await supabase
        .from("gigs")
        .insert({
          band_id: params.bandId,
          venue_id: params.venueId,
          scheduled_date: params.scheduledDate,
          setlist_id: params.setlistId,
          status: "scheduled",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-gigs"] });
      toast({
        title: "Gig added",
        description: "Gig has been added to the tour.",
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
    addGigToTour,
  };
};
