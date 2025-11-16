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
    addGigToTour,
  };
};
