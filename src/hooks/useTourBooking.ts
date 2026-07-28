import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { assertWellnessAllows } from "@/hooks/useActivityBooking";

export interface TourBookingData {
  name: string;
  artistId: string;
  startDate: string;
  endDate: string;
  setlistId: string;
  travelMode: 'auto' | 'manual' | 'tour_bus';
  tourBusCost?: number;
  ticketPrice?: number;
  ticketOperatorId?: string;
  riderId?: string;
  venues: Array<{
    venueId: string;
    cityId: string;
    date: string;
    timeSlot: string;
  }>;
}

type TourBookingError = {
  message?: string;
  details?: string;
};

function getTourBookingError(error: TourBookingError): string {
  const message = error.message ?? '';
  const errors: Record<string, string> = {
    tour_booking_dates_invalid: 'Choose a valid future tour date range.',
    tour_booking_stops_invalid: 'Add at least one complete tour stop.',
    tour_booking_duplicate_stop: 'The tour contains the same venue, date and slot more than once.',
    tour_booking_stop_outside_dates: 'Every gig must fall within the tour start and end dates.',
    tour_booking_forbidden: 'You do not have permission to book gigs for this band.',
    gig_booking_band_conflict: 'A band member already has another activity or gig at that time.',
    gig_booking_venue_conflict: 'One of the venues is already booked for that time.',
    gig_booking_venue_cooldown: 'The band has played one of these venues too recently.',
    gig_booking_past_date: 'One of the selected gig dates is in the past.',
    gig_booking_setlist_invalid: 'The selected setlist is not eligible or does not fit the chosen slot.',
    gig_booking_operator_required: 'Select a ticket operator for tours using venues with 200 or more capacity.',
    gig_booking_insufficient_funds: 'The band cannot afford the total booking fees for this tour.',
    gig_booking_band_lockout: 'The band is currently unavailable for another booking.',
  };

  const key = Object.keys(errors).find((candidate) => message.includes(candidate));
  return key ? errors[key] : 'The tour could not be booked. No partial tour was created; review the dates, venues and band schedule and try again.';
}

export function useTourBooking() {
  const { toast } = useToast();
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  const calculateTourCosts = async (tourData: TourBookingData) => {
    const { data: routes, error } = await supabase
      .from('city_transport_routes')
      .select('*');

    if (error) throw error;

    let travelCosts = 0;

    if (tourData.travelMode === 'tour_bus') {
      const milliseconds = new Date(tourData.endDate).getTime() - new Date(tourData.startDate).getTime();
      const tourDays = Math.max(1, Math.ceil(milliseconds / (1000 * 60 * 60 * 24)) + 1);
      travelCosts = (tourData.tourBusCost || 500) * tourDays;
    } else if (tourData.travelMode === 'auto') {
      for (let i = 0; i < tourData.venues.length - 1; i += 1) {
        const fromCity = tourData.venues[i].cityId;
        const toCity = tourData.venues[i + 1].cityId;
        const route = routes?.find((item) => item.from_city_id === fromCity && item.to_city_id === toCity);
        travelCosts += route?.base_cost ?? 200;
      }
    }

    const nightsNeeded = Math.max(0, tourData.venues.length - 1);
    const accommodationCosts = nightsNeeded * 100;
    const crewCosts = tourData.venues.length * 3 * 150;

    return {
      travelCosts,
      accommodationCosts,
      crewCosts,
      totalCosts: travelCosts + accommodationCosts + crewCosts,
    };
  };

  const createTour = useMutation({
    mutationFn: async (tourData: TourBookingData) => {
      if (!profileId) throw new Error('No active profile');
      if (!tourData.name.trim()) throw new Error('Tour name is required');
      if (!tourData.setlistId) throw new Error('A setlist is required');
      if (tourData.venues.length === 0) throw new Error('At least one venue is required');

      const start = new Date(`${tourData.startDate}T00:00:00`);
      const end = new Date(`${tourData.endDate}T00:00:00`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
        throw new Error('tour_booking_dates_invalid');
      }

      await assertWellnessAllows(profileId, 'travel');
      await assertWellnessAllows(profileId, 'gig');

      const requestId = crypto.randomUUID();
      const { data, error } = await (supabase.rpc as any)('book_tour', {
        p_band_id: tourData.artistId,
        p_name: tourData.name.trim(),
        p_start_date: tourData.startDate,
        p_end_date: tourData.endDate,
        p_setlist_id: tourData.setlistId,
        p_ticket_price: tourData.ticketPrice ?? 20,
        p_stops: tourData.venues.map((venue) => ({
          venue_id: venue.venueId,
          city_id: venue.cityId,
          date: venue.date,
          slot: venue.timeSlot,
        })),
        p_request_id: requestId,
        p_ticket_operator_id: tourData.ticketOperatorId || null,
        p_rider_id: tourData.riderId || null,
        p_travel_mode: tourData.travelMode,
      });

      if (error) throw error;
      const result = data as { tour?: { id: string }; gig_ids?: string[] } | null;
      if (!result?.tour?.id) throw new Error('The booking service returned an invalid tour response.');

      return result;
    },
    onSuccess: (result) => {
      const gigCount = result.gig_ids?.length ?? 0;
      toast({
        title: 'Tour created!',
        description: `${gigCount} gig${gigCount === 1 ? '' : 's'} booked successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      queryClient.invalidateQueries({ queryKey: ['tour-gigs'] });
      queryClient.invalidateQueries({ queryKey: ['gigs'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-activities'] });
    },
    onError: (error: TourBookingError) => {
      console.error('Error creating tour:', error);
      toast({
        title: 'Tour creation failed',
        description: getTourBookingError(error),
        variant: 'destructive',
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
      const { data, error } = await supabase.from('tours').select('*').eq('id', tourId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!tourId,
  });
}
