import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth-context';
import { 
  TourWizardState, 
  DEFAULT_WIZARD_STATE,
  TourScope,
  TravelMode,
  VenueMatch,
  TourCostEstimate,
  TOUR_SCOPE_REQUIREMENTS,
} from '@/lib/tourTypes';
import {
  calculateTourCostEstimate,
  getMaxVenueCapacityForFans,
  canAccessScope,
  generateTourSchedule,
  calculateTourEndDate,
} from '@/utils/tourCalculations';

export interface UseTourWizardOptions {
  bandId?: string;
}

export function useTourWizard(options: UseTourWizardOptions = {}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [state, setState] = useState<TourWizardState>({
    ...DEFAULT_WIZARD_STATE,
    bandId: options.bandId || null,
  });
  
  const [currentStep, setCurrentStep] = useState(0);

  // Fetch band data
  const { data: band } = useQuery({
    queryKey: ['band-for-tour', options.bandId],
    queryFn: async () => {
      if (!options.bandId) return null;
      const { data, error } = await supabase
        .from('bands')
        .select('*')
        .eq('id', options.bandId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!options.bandId,
  });

  // Fetch available countries based on scope
  const { data: availableCountries } = useQuery({
    queryKey: ['tour-countries', state.scope, state.selectedContinents],
    queryFn: async () => {
      let query = supabase
        .from('cities')
        .select('country, region')
        .not('country', 'is', null);
      
      if (state.scope === 'country' && band) {
        // For country tours, only show the band's home country or current location
        // Simplified: show all countries for now
      }
      
      if (state.scope === 'continent' && state.selectedContinents.length > 0) {
        query = query.in('region', state.selectedContinents);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Get unique countries
      const countries = [...new Set(data?.map(c => c.country).filter(Boolean))] as string[];
      return countries.sort();
    },
  });

  // Fetch available venues based on filters
  const { data: availableVenues, isLoading: venuesLoading } = useQuery({
    queryKey: ['tour-venues', state.selectedCountries, state.venueTypes, state.maxVenueCapacity],
    queryFn: async () => {
      if (state.selectedCountries.length === 0) return [];
      
      // Get cities in selected countries
      const { data: cities, error: citiesError } = await supabase
        .from('cities')
        .select('id, name, country')
        .in('country', state.selectedCountries);
      
      if (citiesError) throw citiesError;
      if (!cities || cities.length === 0) return [];
      
      const cityIds = cities.map(c => c.id);
      
      // Get venues in those cities
      let venueQuery = supabase
        .from('venues')
        .select('*')
        .in('city_id', cityIds)
        .lte('capacity', state.maxVenueCapacity);
      
      if (state.venueTypes.length > 0) {
        venueQuery = venueQuery.in('venue_type', state.venueTypes);
      }
      
      const { data: venues, error: venuesError } = await venueQuery;
      if (venuesError) throw venuesError;
      
      // Map venues with city info
      return venues?.map(v => {
        const city = cities.find(c => c.id === v.city_id);
        return {
          ...v,
          cityName: city?.name || 'Unknown',
          country: city?.country || 'Unknown',
        };
      }) || [];
    },
    enabled: state.selectedCountries.length > 0,
  });

  // Fetch setlists for the band
  const { data: setlists } = useQuery({
    queryKey: ['band-setlists', options.bandId],
    queryFn: async () => {
      if (!options.bandId) return [];
      const { data, error } = await supabase
        .from('setlists')
        .select('*')
        .eq('band_id', options.bandId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!options.bandId,
  });

  // Calculate max venue capacity based on band fans
  const maxAllowedCapacity = useMemo(() => {
    return getMaxVenueCapacityForFans(band?.total_fans || 0);
  }, [band?.total_fans]);

  // Check scope access
  const scopeAccess = useMemo(() => {
    const fame = band?.fame || 0;
    return {
      country: canAccessScope(fame, 'country'),
      continent: canAccessScope(fame, 'continent'),
      world: canAccessScope(fame, 'world'),
    };
  }, [band?.fame]);

  // Generate venue matches for the tour
  const venueMatches = useMemo((): VenueMatch[] => {
    if (!availableVenues || availableVenues.length === 0) return [];
    
    const showCount = state.targetShowCount || Math.min(
      Math.floor((state.durationDays || 30) / (1 + state.minRestDays)),
      availableVenues.length
    );
    
    // Select one venue per city, up to showCount
    const citiesUsed = new Set<string>();
    const matches: VenueMatch[] = [];
    const schedule = state.startDate 
      ? generateTourSchedule(new Date(state.startDate), showCount, state.minRestDays)
      : [];
    
    // Sort venues by capacity (prefer mid-range for reliability)
    const sortedVenues = [...availableVenues].sort((a, b) => {
      const aScore = Math.abs((a.capacity || 0) - (band?.total_fans || 500) * 0.3);
      const bScore = Math.abs((b.capacity || 0) - (band?.total_fans || 500) * 0.3);
      return aScore - bScore;
    });
    
    for (const venue of sortedVenues) {
      if (matches.length >= showCount) break;
      if (citiesUsed.has(venue.city_id || '')) continue; // One show per city
      
      citiesUsed.add(venue.city_id || '');
      matches.push({
        venueId: venue.id,
        venueName: venue.name,
        cityId: venue.city_id || '',
        cityName: venue.cityName,
        country: venue.country,
        capacity: venue.capacity || 500,
        venueType: venue.venue_type || 'club',
        basePayment: venue.base_payment || 0,
        bookingFee: 50, // Will be calculated properly
        estimatedTicketRevenue: 0, // Will be calculated
        date: schedule[matches.length]?.toISOString().split('T')[0] || '',
      });
    }
    
    return matches;
  }, [availableVenues, state.targetShowCount, state.durationDays, state.minRestDays, state.startDate, band?.total_fans]);

  // Calculate cost estimate
  const costEstimate = useMemo((): TourCostEstimate => {
    return calculateTourCostEstimate(
      venueMatches,
      state,
      band?.fame || 0,
      band?.total_fans || 0
    );
  }, [venueMatches, state, band?.fame, band?.total_fans]);

  // Update state helpers
  const updateState = useCallback((updates: Partial<TourWizardState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const setScope = useCallback((scope: TourScope) => {
    updateState({ 
      scope, 
      selectedCountries: [], 
      selectedContinents: [] 
    });
  }, [updateState]);

  const toggleCountry = useCallback((country: string) => {
    setState(prev => ({
      ...prev,
      selectedCountries: prev.selectedCountries.includes(country)
        ? prev.selectedCountries.filter(c => c !== country)
        : [...prev.selectedCountries, country],
    }));
  }, []);

  const toggleContinent = useCallback((continent: string) => {
    setState(prev => ({
      ...prev,
      selectedContinents: prev.selectedContinents.includes(continent)
        ? prev.selectedContinents.filter(c => c !== continent)
        : [...prev.selectedContinents, continent],
      selectedCountries: [], // Reset countries when continents change
    }));
  }, []);

  // Book tour mutation
  const bookTourMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !state.bandId) throw new Error('Missing user or band');
      
      const endDate = state.startDate 
        ? calculateTourEndDate(
            new Date(state.startDate), 
            venueMatches.length, 
            state.minRestDays
          ).toISOString().split('T')[0]
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Create the tour
      const { data: tour, error: tourError } = await supabase
        .from('tours')
        .insert({
          name: state.name,
          user_id: user.id,
          band_id: state.bandId,
          start_date: state.startDate,
          end_date: endDate,
          scope: state.scope,
          min_rest_days: state.minRestDays,
          travel_mode: state.travelMode,
          tour_bus_daily_cost: state.travelMode === 'tour_bus' ? state.tourBusDailyCost : 0,
          total_upfront_cost: costEstimate.totalUpfrontCost,
          total_travel_cost: costEstimate.travelCosts + costEstimate.tourBusCosts,
          selected_countries: state.selectedCountries,
          selected_continents: state.selectedContinents,
          venue_type_filter: state.venueTypes,
          max_venue_capacity: state.maxVenueCapacity,
          target_show_count: venueMatches.length,
          setlist_id: state.setlistId,
          status: 'scheduled',
        })
        .select()
        .single();

      if (tourError) throw tourError;

      // Create tour_venues entries
      const tourVenues = venueMatches.map(v => ({
        tour_id: tour.id,
        venue_id: v.venueId,
        city_id: v.cityId,
        date: v.date,
        ticket_price: null, // Auto-calculated later
        status: 'scheduled',
        booking_fee: v.bookingFee,
        estimated_revenue: v.estimatedTicketRevenue,
      }));

      if (tourVenues.length > 0) {
        const { error: venuesError } = await supabase
          .from('tour_venues')
          .insert(tourVenues);
        if (venuesError) throw venuesError;
      }

      // Create actual gigs for each venue
      const gigsToCreate = venueMatches.map(v => ({
        venue_id: v.venueId,
        band_id: state.bandId,
        scheduled_date: v.date,
        tour_id: tour.id,
        setlist_id: state.setlistId || null,
        status: 'scheduled',
        ticket_price: 0, // Will be auto-calculated
        booking_fee: v.bookingFee,
        estimated_revenue: v.estimatedTicketRevenue,
      }));

      if (gigsToCreate.length > 0) {
        const { error: gigsError } = await supabase
          .from('gigs')
          .insert(gigsToCreate);
        if (gigsError) throw gigsError;
      }

      // Create travel legs between consecutive venues
      if (venueMatches.length > 1) {
        const travelLegs = [];
        for (let i = 0; i < venueMatches.length - 1; i++) {
          const fromVenue = venueMatches[i];
          const toVenue = venueMatches[i + 1];
          
          // Calculate departure as day after show, arrival as day of next show
          const departureDate = new Date(fromVenue.date);
          departureDate.setDate(departureDate.getDate() + 1);
          const arrivalDate = new Date(toVenue.date);
          
          travelLegs.push({
            tour_id: tour.id,
            from_city_id: fromVenue.cityId,
            to_city_id: toVenue.cityId,
            travel_mode: state.travelMode === 'tour_bus' ? 'bus' : 'auto',
            travel_cost: 0, // Will be calculated based on mode
            departure_date: departureDate.toISOString(),
            arrival_date: arrivalDate.toISOString(),
            sequence_order: i,
          });
        }

        if (travelLegs.length > 0) {
          const { error: travelError } = await supabase
            .from('tour_travel_legs')
            .insert(travelLegs);
          if (travelError) throw travelError;
        }
      }

      // Deduct upfront cost from band balance
      if (costEstimate.totalUpfrontCost > 0) {
        const { error: balanceError } = await supabase
          .from('bands')
          .update({ 
            band_balance: (band?.band_balance || 0) - costEstimate.totalUpfrontCost 
          })
          .eq('id', state.bandId);
        if (balanceError) throw balanceError;
      }

      return tour;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      queryClient.invalidateQueries({ queryKey: ['band-for-tour'] });
      toast({
        title: 'Tour booked!',
        description: `${state.name} has been scheduled with ${venueMatches.length} shows.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to book tour',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Navigation
  const nextStep = useCallback(() => {
    setCurrentStep(prev => Math.min(prev + 1, 5));
  }, []);

  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  }, []);

  const goToStep = useCallback((step: number) => {
    setCurrentStep(Math.max(0, Math.min(step, 5)));
  }, []);

  // Validation
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 0: // Basics
        return state.name.trim() !== '' && state.startDate !== '';
      case 1: // Scope
        return scopeAccess[state.scope];
      case 2: // Countries
        return state.selectedCountries.length > 0;
      case 3: // Venues
        return state.venueTypes.length > 0;
      case 4: // Travel
        return true; // Travel mode always has a default
      case 5: // Review
        return venueMatches.length > 0 && (band?.band_balance || 0) >= costEstimate.totalUpfrontCost;
      default:
        return false;
    }
  }, [currentStep, state, scopeAccess, venueMatches.length, band?.band_balance, costEstimate.totalUpfrontCost]);

  return {
    state,
    updateState,
    setScope,
    toggleCountry,
    toggleContinent,
    currentStep,
    nextStep,
    prevStep,
    goToStep,
    canProceed,
    band,
    availableCountries,
    availableVenues,
    venuesLoading,
    setlists,
    venueMatches,
    costEstimate,
    maxAllowedCapacity,
    scopeAccess,
    bookTour: bookTourMutation.mutate,
    isBooking: bookTourMutation.isPending,
  };
}
