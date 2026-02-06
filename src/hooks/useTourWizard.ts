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
  STAGE_SETUP_TIERS,
  StageSetupTier,
  TOUR_MERCH_BOOST,
  TOUR_BUS_DAILY_COST,
  MEMBER_TRAVEL_COST_PER_LEG,
} from '@/lib/tourTypes';
import {
  getMaxVenueCapacityForFans,
  canAccessScope,
  generateTourSchedule,
  calculateTourEndDate,
  calculateTicketPrice,
  estimateTicketSalesPercent,
  calculateBookingFee,
  calculateTourBusCost,
  estimateMerchSalesPerAttendee,
} from '@/utils/tourCalculations';
import { createBandScheduledActivities } from '@/utils/bandActivityScheduling';

export interface UseTourWizardOptions {
  bandId?: string;
}

const WIZARD_STEPS = [
  'Basics',
  'Scope', 
  'Countries',
  'Venues',
  'Tickets',
  'Stage Setup',
  'Travel',
  'Support Artist',
  'Review'
];

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

  // Fetch player's current city
  const { data: playerProfile } = useQuery({
    queryKey: ['player-profile-for-tour', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('current_city_id')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch available countries based on scope
  const { data: availableCountries } = useQuery({
    queryKey: ['tour-countries', state.scope, state.selectedContinents],
    queryFn: async () => {
      let query = supabase
        .from('cities')
        .select('country, region')
        .not('country', 'is', null);
      
      if (state.scope === 'continent' && state.selectedContinents.length > 0) {
        query = query.in('region', state.selectedContinents);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      const countries = [...new Set(data?.map(c => c.country).filter(Boolean))] as string[];
      return countries.sort();
    },
  });

  // Fetch available venues based on filters
  const { data: availableVenues, isLoading: venuesLoading } = useQuery({
    queryKey: ['tour-venues', state.selectedCountries, state.venueTypes, state.maxVenueCapacity, state.venueGenreFilter, state.venueCityFilter, state.venueCountryFilter],
    queryFn: async () => {
      if (state.selectedCountries.length === 0) return [];
      
      // Get cities in selected countries
      let citiesQuery = supabase
        .from('cities')
        .select('id, name, country')
        .in('country', state.selectedCountries);
      
      if (state.venueCountryFilter) {
        citiesQuery = citiesQuery.eq('country', state.venueCountryFilter);
      }
      
      if (state.venueCityFilter) {
        citiesQuery = citiesQuery.eq('id', state.venueCityFilter);
      }
      
      const { data: cities, error: citiesError } = await citiesQuery;
      
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
      
      // Map venues with city info and filter by genre if needed
      return venues?.map(v => {
        const city = cities.find(c => c.id === v.city_id);
        return {
          ...v,
          cityName: city?.name || 'Unknown',
          country: city?.country || 'Unknown',
        };
      }).filter(v => {
        // Filter by genre if specified
        if (state.venueGenreFilter && v.genre_bias && typeof v.genre_bias === 'string') {
          return v.genre_bias.toLowerCase().includes(state.venueGenreFilter.toLowerCase());
        }
        return true;
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

  // Check support artist eligibility (fame > 5000, 5+ shows)
  const canInviteSupportArtist = useMemo(() => {
    const fame = band?.fame || 0;
    const showCount = state.targetShowCount || Math.min(
      Math.floor((state.durationDays || 30) / (1 + state.minRestDays)),
      availableVenues?.length || 0
    );
    return fame >= 5000 && showCount >= 5;
  }, [band?.fame, state.targetShowCount, state.durationDays, state.minRestDays, availableVenues?.length]);

  // Generate venue matches for the tour
  const venueMatches = useMemo((): VenueMatch[] => {
    if (!availableVenues || availableVenues.length === 0) return [];
    
    const showCount = state.targetShowCount || Math.min(
      Math.floor((state.durationDays || 30) / (1 + state.minRestDays)),
      availableVenues.length
    );
    
    // If user manually selected venues, use those
    if (state.selectedVenueIds.length > 0) {
      const selectedVenues = availableVenues.filter(v => state.selectedVenueIds.includes(v.id));
      const schedule = state.startDate 
        ? generateTourSchedule(new Date(state.startDate), selectedVenues.length, state.minRestDays)
        : [];
      
      return selectedVenues.map((v, i) => ({
        venueId: v.id,
        venueName: v.name,
        cityId: v.city_id || '',
        cityName: v.cityName,
        country: v.country,
        capacity: v.capacity || 500,
        venueType: v.venue_type || 'club',
        basePayment: v.base_payment || 0,
        bookingFee: 50,
        estimatedTicketRevenue: 0,
        date: schedule[i]?.toISOString().split('T')[0] || '',
        genre: typeof v.genre_bias === 'string' ? v.genre_bias : undefined,
      }));
    }
    
    // Auto-select venues
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
      if (citiesUsed.has(venue.city_id || '')) continue;
      
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
        bookingFee: 50,
        estimatedTicketRevenue: 0,
        date: schedule[matches.length]?.toISOString().split('T')[0] || '',
        genre: typeof venue.genre_bias === 'string' ? venue.genre_bias : undefined,
      });
    }
    
    return matches;
  }, [availableVenues, state.targetShowCount, state.durationDays, state.minRestDays, state.startDate, state.selectedVenueIds, band?.total_fans]);

  // Calculate recommended ticket price
  const recommendedTicketPrice = useMemo(() => {
    if (venueMatches.length === 0) return 20;
    const avgCapacity = venueMatches.reduce((sum, v) => sum + v.capacity, 0) / venueMatches.length;
    return calculateTicketPrice(avgCapacity, band?.fame || 0);
  }, [venueMatches, band?.fame]);

  // Calculate cost estimate with all new fields
  const costEstimate = useMemo((): TourCostEstimate => {
    const ticketPrice = state.customTicketPrice || recommendedTicketPrice;
    const stageSetupTier = STAGE_SETUP_TIERS[state.stageSetupTier];
    
    let venueCosts = 0;
    let bookingFees = 0;
    let estimatedTicketRevenue = 0;
    let estimatedMerchRevenue = 0;
    
    for (const venue of venueMatches) {
      venueCosts += venue.basePayment;
      
      const salesPercent = estimateTicketSalesPercent(venue.capacity, band?.total_fans || 0, band?.fame || 0);
      const ticketsSold = Math.floor(venue.capacity * salesPercent);
      const venueRevenue = ticketsSold * ticketPrice;
      
      const fee = calculateBookingFee(venueRevenue);
      bookingFees += fee;
      estimatedTicketRevenue += venueRevenue;
      
      // Merch with tour boost and stage setup boost
      const merchPerAttendee = estimateMerchSalesPerAttendee(band?.fame || 0);
      const merchBoost = TOUR_MERCH_BOOST * stageSetupTier.merchBoost;
      estimatedMerchRevenue += Math.round(ticketsSold * merchPerAttendee * merchBoost);
    }
    
    // Travel costs (simplified)
    const travelCosts = venueMatches.length * 100;
    
    // Tour bus costs (static rate)
    const tourBusCosts = state.travelMode === 'tour_bus'
      ? calculateTourBusCost(state.durationDays || 30, TOUR_BUS_DAILY_COST)
      : 0;
    
    // Stage setup costs
    const stageSetupCosts = stageSetupTier.costPerShow * venueMatches.length;
    
    // Sponsor cash
    const sponsorCashIncome = state.sponsorCashValue;
    
    // Support artist share
    const supportArtistShare = state.supportBandId 
      ? Math.round(estimatedTicketRevenue * state.supportRevenueShare)
      : 0;
    
    // Member travel costs (placeholder - actual count fetched when booking tour)
    const travelingMemberCount = 1; // Will be calculated from band_members.travels_with_band
    const legCount = Math.max(0, venueMatches.length - 1);
    const travelModeForMembers = state.travelMode === 'tour_bus' ? 'tour_bus' : 'bus';
    const memberTravelCosts = (MEMBER_TRAVEL_COST_PER_LEG[travelModeForMembers] || 0) * travelingMemberCount * legCount;
    
    const totalUpfrontCost = venueCosts + bookingFees + travelCosts + tourBusCosts + stageSetupCosts + memberTravelCosts;
    const netUpfrontCost = Math.max(0, totalUpfrontCost - sponsorCashIncome);
    const estimatedRevenue = estimatedTicketRevenue + estimatedMerchRevenue - supportArtistShare;
    const estimatedProfit = estimatedRevenue - totalUpfrontCost + sponsorCashIncome;
    
    return {
      venueCosts,
      bookingFees,
      travelCosts,
      tourBusCosts,
      stageSetupCosts,
      memberTravelCosts,
      travelingMemberCount,
      totalUpfrontCost,
      sponsorCashIncome,
      netUpfrontCost,
      estimatedTicketRevenue,
      estimatedMerchRevenue,
      supportArtistShare,
      estimatedRevenue,
      estimatedProfit,
      showCount: venueMatches.length,
    };
  }, [venueMatches, state, band?.fame, band?.total_fans, recommendedTicketPrice]);

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
      selectedCountries: [],
    }));
  }, []);

  const toggleVenue = useCallback((venueId: string) => {
    setState(prev => ({
      ...prev,
      selectedVenueIds: prev.selectedVenueIds.includes(venueId)
        ? prev.selectedVenueIds.filter(id => id !== venueId)
        : [...prev.selectedVenueIds, venueId],
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

      const ticketPrice = state.customTicketPrice || recommendedTicketPrice;

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
          tour_bus_daily_cost: state.travelMode === 'tour_bus' ? TOUR_BUS_DAILY_COST : 0,
          total_upfront_cost: costEstimate.netUpfrontCost,
          total_travel_cost: costEstimate.travelCosts + costEstimate.tourBusCosts,
          selected_countries: state.selectedCountries,
          selected_continents: state.selectedContinents,
          venue_type_filter: state.venueTypes,
          max_venue_capacity: state.maxVenueCapacity,
          target_show_count: venueMatches.length,
          setlist_id: state.setlistId,
          status: 'scheduled',
          // New fields
          starting_city_id: state.startingCityId,
          custom_ticket_price: ticketPrice,
          stage_setup_tier: state.stageSetupTier,
          stage_setup_cost: costEstimate.stageSetupCosts,
          support_band_id: state.supportBandId,
          support_revenue_share: state.supportRevenueShare,
          sponsor_offer_id: state.selectedSponsorOfferId,
          sponsor_cash_value: state.sponsorCashValue,
          sponsor_fame_penalty: state.sponsorFamePenalty,
          sponsor_ticket_penalty: state.sponsorTicketPenalty,
          merch_boost_multiplier: TOUR_MERCH_BOOST * STAGE_SETUP_TIERS[state.stageSetupTier].merchBoost,
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
        ticket_price: ticketPrice,
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
        ticket_price: ticketPrice,
        booking_fee: v.bookingFee,
        estimated_revenue: v.estimatedTicketRevenue,
      }));

      let createdGigs: any[] = [];
      if (gigsToCreate.length > 0) {
        const { data: gigs, error: gigsError } = await supabase
          .from('gigs')
          .insert(gigsToCreate)
          .select();
        if (gigsError) throw gigsError;
        createdGigs = gigs || [];
      }

      // Create scheduled activities for all band members for each gig
      for (const gig of createdGigs) {
        const venue = venueMatches.find(v => v.venueId === gig.venue_id);
        const gigDate = new Date(gig.scheduled_date);
        const gigEnd = new Date(gigDate);
        gigEnd.setHours(gigEnd.getHours() + 4); // Assume 4 hour show

        try {
          await createBandScheduledActivities({
            bandId: state.bandId!,
            activityType: 'gig',
            scheduledStart: gigDate,
            scheduledEnd: gigEnd,
            title: `Tour: ${state.name} - ${venue?.venueName || 'Show'}`,
            location: venue?.cityName,
            linkedGigId: gig.id,
            metadata: {
              tourId: tour.id,
              venueId: gig.venue_id,
              venueCity: venue?.cityName,
              isHeadliner: true,
              isTourGig: true,
            },
          });
        } catch (e) {
          console.error('Failed to create band scheduled activities:', e);
        }

        // If support band, create activities for them too
        if (state.supportBandId) {
          try {
            await createBandScheduledActivities({
              bandId: state.supportBandId,
              activityType: 'gig',
              scheduledStart: gigDate,
              scheduledEnd: gigEnd,
              title: `Tour (Support): ${state.name} - ${venue?.venueName || 'Show'}`,
              location: venue?.cityName,
              linkedGigId: gig.id,
              metadata: {
                tourId: tour.id,
                venueId: gig.venue_id,
                venueCity: venue?.cityName,
                isHeadliner: false,
                headlinerBandId: state.bandId,
                isTourGig: true,
              },
            });
          } catch (e) {
            console.error('Failed to create support band scheduled activities:', e);
          }
        }
      }

      // Create travel legs between consecutive venues
      if (venueMatches.length > 1) {
        const travelLegs = [];
        for (let i = 0; i < venueMatches.length - 1; i++) {
          const fromVenue = venueMatches[i];
          const toVenue = venueMatches[i + 1];
          
          const departureDate = new Date(fromVenue.date);
          departureDate.setDate(departureDate.getDate() + 1);
          const arrivalDate = new Date(toVenue.date);
          
          travelLegs.push({
            tour_id: tour.id,
            from_city_id: fromVenue.cityId,
            to_city_id: toVenue.cityId,
            travel_mode: state.travelMode || 'bus',
            travel_cost: 0,
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
      if (costEstimate.netUpfrontCost > 0) {
        const { error: balanceError } = await supabase
          .from('bands')
          .update({ 
            band_balance: (band?.band_balance || 0) - costEstimate.netUpfrontCost 
          })
          .eq('id', state.bandId);
        if (balanceError) throw balanceError;
      }

      return tour;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      queryClient.invalidateQueries({ queryKey: ['band-for-tour'] });
      queryClient.invalidateQueries({ queryKey: ['player-scheduled-activities'] });
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
  const totalSteps = WIZARD_STEPS.length;
  
  const nextStep = useCallback(() => {
    setCurrentStep(prev => {
      // Skip support artist step if not eligible
      if (prev === 6 && !canInviteSupportArtist) {
        return Math.min(prev + 2, totalSteps - 1);
      }
      return Math.min(prev + 1, totalSteps - 1);
    });
  }, [totalSteps, canInviteSupportArtist]);

  const prevStep = useCallback(() => {
    setCurrentStep(prev => {
      // Skip support artist step if not eligible
      if (prev === 8 && !canInviteSupportArtist) {
        return Math.max(prev - 2, 0);
      }
      return Math.max(prev - 1, 0);
    });
  }, [canInviteSupportArtist]);

  const goToStep = useCallback((step: number) => {
    setCurrentStep(Math.max(0, Math.min(step, totalSteps - 1)));
  }, [totalSteps]);

  // Validation
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 0: // Basics
        return state.name.trim() !== '' && state.startDate !== '' && state.startingCityId !== null;
      case 1: // Scope
        return scopeAccess[state.scope];
      case 2: // Countries
        return state.selectedCountries.length > 0;
      case 3: // Venues
        return state.venueTypes.length > 0 && venueMatches.length > 0;
      case 4: // Tickets
        return true; // Always valid, uses recommended if not set
      case 5: // Stage Setup
        return (band?.fame || 0) >= STAGE_SETUP_TIERS[state.stageSetupTier].minFame;
      case 6: // Travel
        return true;
      case 7: // Support Artist
        return true; // Optional step
      case 8: // Review
        return venueMatches.length > 0 && (band?.band_balance || 0) >= costEstimate.netUpfrontCost;
      default:
        return false;
    }
  }, [currentStep, state, scopeAccess, venueMatches.length, band?.band_balance, band?.fame, costEstimate.netUpfrontCost]);

  return {
    state,
    updateState,
    setScope,
    toggleCountry,
    toggleContinent,
    toggleVenue,
    currentStep,
    totalSteps,
    stepNames: WIZARD_STEPS,
    nextStep,
    prevStep,
    goToStep,
    canProceed,
    band,
    playerCurrentCityId: playerProfile?.current_city_id,
    availableCountries,
    availableVenues,
    venuesLoading,
    setlists,
    venueMatches,
    costEstimate,
    maxAllowedCapacity,
    scopeAccess,
    recommendedTicketPrice,
    canInviteSupportArtist,
    bookTour: bookTourMutation.mutate,
    isBooking: bookTourMutation.isPending,
  };
}
