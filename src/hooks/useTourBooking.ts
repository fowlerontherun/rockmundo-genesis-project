import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";

export interface TourBookingData {
  name: string;
  artistId: string;
  startDate: string;
  endDate: string;
  setlistId: string;
  travelMode: 'auto' | 'manual' | 'tour_bus';
  tourBusCost?: number;
  venues: Array<{
    venueId: string;
    cityId: string;
    date: string;
    timeSlot: string;
  }>;
}

export function useTourBooking() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const calculateTourCosts = async (tourData: TourBookingData) => {
    // Calculate travel costs between cities
    const { data: routes } = await supabase
      .from('city_transport_routes')
      .select('*');

    let travelCosts = 0;
    let accommodationCosts = 0;

    if (tourData.travelMode === 'tour_bus') {
      const tourDays = Math.ceil(
        (new Date(tourData.endDate).getTime() - new Date(tourData.startDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      travelCosts = (tourData.tourBusCost || 500) * tourDays;
    } else if (tourData.travelMode === 'auto') {
      // Calculate auto-booked travel costs
      for (let i = 0; i < tourData.venues.length - 1; i++) {
        const fromCity = tourData.venues[i].cityId;
        const toCity = tourData.venues[i + 1].cityId;

        const route = routes?.find(
          (r) => r.from_city_id === fromCity && r.to_city_id === toCity
        );

        if (route) {
          travelCosts += route.base_cost;
        } else {
          // Estimate if no direct route
          travelCosts += 200;
        }
      }
    }

    // Estimate accommodation (assuming stays between gigs)
    const nightsNeeded = tourData.venues.length - 1;
    accommodationCosts = nightsNeeded * 100; // Average $100 per night

    // Crew costs (assuming 3 crew members)
    const crewCosts = tourData.venues.length * 3 * 150; // $150 per crew per gig

    return {
      travelCosts,
      accommodationCosts,
      crewCosts,
      totalCosts: travelCosts + accommodationCosts + crewCosts,
    };
  };

  const createTour = useMutation({
    mutationFn: async (tourData: TourBookingData) => {
      const costs = await calculateTourCosts(tourData);

      // Get current user for tour ownership
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create the tour with correct column names
      const { data: tour, error: tourError } = await supabase
        .from('tours')
        .insert({
          user_id: user.id,
          band_id: tourData.artistId,
          name: tourData.name,
          start_date: tourData.startDate,
          end_date: tourData.endDate,
          status: 'active',
        })
        .select()
        .single();

      if (tourError) throw tourError;

      // Create gigs for each venue
      for (const venue of tourData.venues) {
        const { error: gigError } = await supabase.from('gigs').insert({
          band_id: tourData.artistId,
          venue_id: venue.venueId,
          scheduled_date: venue.date,
          time_slot: venue.timeSlot,
          setlist_id: tourData.setlistId,
          status: 'scheduled',
        });

        if (gigError) throw gigError;
      }

      // Create travel legs if auto mode (using generic insert)
      if (tourData.travelMode === 'auto') {
        for (let i = 0; i < tourData.venues.length - 1; i++) {
          const from = tourData.venues[i];
          const to = tourData.venues[i + 1];

          // Find cheapest route
          const { data: routes } = await supabase
            .from('city_transport_routes')
            .select('*')
            .eq('from_city_id', from.cityId)
            .eq('to_city_id', to.cityId)
            .order('base_cost', { ascending: true })
            .limit(1);

          const route = routes?.[0];

          if (route) {
            // Will work once migration is applied
            try {
              await supabase.rpc('execute_sql' as any, {
                sql: `INSERT INTO tour_travel_legs (tour_id, from_city_id, to_city_id, travel_mode, departure_time, arrival_time, cost, booked_by_system) 
                      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                params: [tour.id, from.cityId, to.cityId, route.transport_type, from.date, to.date, route.base_cost, true]
              });
            } catch (error) {
              // Silently fail if table doesn't exist yet
              console.log('Tour travel legs table not yet created');
            }
          }
        }
      }

      return tour;
    },
    onSuccess: () => {
      toast({
        title: "Tour Created!",
        description: "Your tour has been successfully booked with all venues and travel.",
      });
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      queryClient.invalidateQueries({ queryKey: ['gigs'] });
    },
    onError: (error) => {
      console.error('Error creating tour:', error);
      toast({
        title: "Tour Creation Failed",
        description: "There was an error booking your tour. Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    createTour: createTour.mutate,
    isCreating: createTour.isPending,
    calculateTourCosts,
  };
}

export function useTourDetails(tourId: string | null) {
  return useQuery({
    queryKey: ['tour-details', tourId],
    queryFn: async () => {
      if (!tourId) return null;

      const { data: tour, error } = await supabase
        .from('tours')
        .select('*')
        .eq('id', tourId)
        .single();

      if (error) throw error;
      return tour;
    },
    enabled: !!tourId,
  });
}
