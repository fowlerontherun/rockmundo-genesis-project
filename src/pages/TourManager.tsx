import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar, 
  Users, 
  MapPin, 
  Star, 
  TrendingUp, 
  DollarSign,
  AlertCircle,
  Plane,
  Music,
  Clock,
  Plus,
  Settings
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { meetsRequirements } from "@/utils/gameBalance";
import { fetchEnvironmentModifiers, type EnvironmentModifierSummary, type AppliedEnvironmentEffect } from "@/utils/worldEnvironment";
import {
  calculateTravelEstimates,
  describeComfort,
  getTravelModeConfig,
  LOW_COMFORT_THRESHOLD,
  TRAVEL_MODE_OPTIONS,
  TRAVEL_MODES,
  type TravelMode,
} from "@/utils/worldTravel";
import type { Database } from "@/integrations/supabase/types";

interface Tour {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
  total_revenue: number;
  band_id?: string;
  venues: TourVenue[];
  tour_venues?: TourVenue[];
}

interface TourVenue {
  id: string;
  venue_id: string;
  date: string;
  ticket_price: number | null;
  marketing_spend: number | null;
  tickets_sold: number | null;
  revenue: number | null;
  travel_cost: number | null;
  lodging_cost: number | null;
  misc_cost: number | null;
  travel_time: number | null;
  rest_days: number | null;
  status: string | null;
  travel_mode?: TravelMode | null;
  travel_comfort?: number | null;
  venues?: {
    name: string;
    location: string;
    capacity: number;
  };
  venue?: {
    name: string;
    location: string;
    capacity: number;
  };
  environment_modifiers?: EnvironmentModifierSummary | null;
  show_type?: ShowType;
}

interface VenueScheduleForm {
  venueId: string;
  date: string;
  ticketPrice: string;
  travelCost: string;
  lodgingCost: string;
  miscCost: string;
  travelMode: TravelMode;
}

interface NewTourVenueDetails {
  venueId: string;
  date: string;
  ticketPrice: number;
  travelMode: TravelMode;
  travelCost: number;
  lodgingCost: number;
  miscCost: number;
  travelTime?: number;
  restDays?: number;
  travelComfort: number;
}

interface RouteSuggestion {
  order: TourVenue[];
  totalDistance: number;
}

interface EditTourVenueForm {
  id: string;
  venue_id: string;
  date: string;
  status: string;
  ticket_price: number | null;
}

interface EditTourForm {
  start_date: string;
  end_date: string;
  status: string;
  venues: EditTourVenueForm[];
  newVenue: {
    venue_id: string;
    date: string;
    ticket_price: string;
    travel_mode: TravelMode;
  };
}

type VenueRow = Database['public']['Tables']['venues']['Row'];
type CityRow = Database['public']['Tables']['cities']['Row'];
type TourRow = Database['public']['Tables']['tours']['Row'];
type TourVenueRow = Database['public']['Tables']['tour_venues']['Row'];
type TourVenueInsert = Database['public']['Tables']['tour_venues']['Insert'] & {
  environment_modifiers?: EnvironmentModifierSummary | null;
};
type TourVenueUpdate = Database['public']['Tables']['tour_venues']['Update'] & {
  environment_modifiers?: EnvironmentModifierSummary | null;
};

type ShowType = Database['public']['Enums']['show_type'];

type SupabaseTour = TourRow & {
  tour_venues?: Array<
    TourVenueRow & {
      venues?: Pick<VenueRow, 'name' | 'location' | 'capacity'> | null;
    }
  >;
};

const LOCATION_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "downtown": { lat: 40.7128, lng: -74.006 },
  "downtown district": { lat: 40.7138, lng: -74.001 },
  "arts district": { lat: 34.043, lng: -118.235 },
  "arts quarter": { lat: 34.05, lng: -118.247 },
  "stadium district": { lat: 39.760, lng: -104.987 },
  "cultural center": { lat: 41.881, lng: -87.623 },
  "city park": { lat: 39.756, lng: -104.966 },
  "suburbs": { lat: 41.0, lng: -87.9 },
  "uptown": { lat: 41.894, lng: -87.634 },
  "sports district": { lat: 34.043, lng: -118.267 },
  "outskirts": { lat: 36.1699, lng: -115.1398 },
  "central": { lat: 39.0997, lng: -94.5786 },
};

const DEFAULT_COORDINATE = { lat: 39.5, lng: -98.35 };
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;
const EARTH_RADIUS_KM = 6371;
const DEFAULT_TRAVEL_MODE: TravelMode = 'coach';
const TRAVEL_MODE_VALUES: TravelMode[] = ['coach', 'taxi', 'air', 'ferry'];
const ALL_CITIES_VALUE = 'all';

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const getCoordinateForLocation = (location?: string | null) => {
  if (!location) return DEFAULT_COORDINATE;
  const normalized = location.trim().toLowerCase();
  if (LOCATION_COORDINATES[normalized]) {
    return LOCATION_COORDINATES[normalized];
  }

  let hash = 0;
  for (const char of normalized) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  const lat = ((hash % 180000) / 1000) - 90;
  const lng = (((Math.floor(hash / 180000)) % 360000) / 1000) - 180;
  return { lat, lng };
};

const calculateDistanceKm = (fromLocation?: string | null, toLocation?: string | null) => {
  const from = getCoordinateForLocation(fromLocation);
  const to = getCoordinateForLocation(toLocation);

  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));

  return Math.round(EARTH_RADIUS_KM * c * 100) / 100;
};

const calculateRestDaysFromDistance = (distanceKm: number, comfort: number) => {
  const distance = Math.max(0, distanceKm || 0);
  const baseRest = Math.max(1, Math.ceil(distance / 600));
  if (comfort >= 80 && baseRest > 1) {
    return baseRest - 1;
  }
  if (comfort < LOW_COMFORT_THRESHOLD) {
    return baseRest + 1;
  }
  return baseRest;
};

const calculateMiscCostFromDistance = (distanceKm: number, comfort: number) => {
  const distance = Math.max(0, distanceKm || 0);
  const comfortPenalty = Math.max(0, (60 - comfort) / 100);
  return Math.max(0, Math.round(distance * 0.2 * (1 + comfortPenalty)));
};

const calculateLodgingCostFromRestDays = (restDays: number) => Math.max(0, restDays * 120);

const normalizeTravelMode = (mode?: string | null): TravelMode | null =>
  TRAVEL_MODE_VALUES.includes(mode as TravelMode) ? (mode as TravelMode) : null;

const buildTravelPlanMetrics = (distanceKm: number, mode: TravelMode) => {
  const estimates = calculateTravelEstimates(distanceKm, mode);
  const restDays = calculateRestDaysFromDistance(distanceKm, estimates.comfort);
  const lodgingCost = calculateLodgingCostFromRestDays(restDays);
  const miscCost = calculateMiscCostFromDistance(distanceKm, estimates.comfort);
  return {
    distanceKm,
    travelMode: estimates.mode,
    travelCost: estimates.cost,
    travelTime: estimates.timeHours,
    travelComfort: estimates.comfort,
    restDays,
    lodgingCost,
    miscCost,
  };
};

const getVenueComfort = (venue: TourVenue) => {
  if (typeof venue.travel_comfort === 'number') {
    return venue.travel_comfort;
  }
  if (venue.travel_mode) {
    return getTravelModeConfig(venue.travel_mode).comfort;
  }
  return TRAVEL_MODES[DEFAULT_TRAVEL_MODE].comfort;
};

const isLowComfortLeg = (comfort: number) => comfort < LOW_COMFORT_THRESHOLD;

const computeHealthPenalty = (comfort: number, streak: number) => {
  if (!isLowComfortLeg(comfort)) {
    return 0;
  }
  const deficitRatio = (LOW_COMFORT_THRESHOLD - comfort) / 100;
  const basePenalty = Math.max(1, Math.round(deficitRatio * 20));
  return -basePenalty * Math.max(1, streak);
};

const computeTourHealthBreakdown = (tour: Tour) => {
  const breakdown: Record<string, { comfort: number; penalty: number; streak: number }> = {};
  const sortedStops = [...(tour.venues || [])].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  let streak = 0;
  sortedStops.forEach((stop) => {
    const comfort = getVenueComfort(stop);
    if (isLowComfortLeg(comfort)) {
      streak += 1;
      breakdown[stop.id] = {
        comfort,
        penalty: computeHealthPenalty(comfort, streak),
        streak,
      };
    } else {
      streak = 0;
      breakdown[stop.id] = {
        comfort,
        penalty: 0,
        streak: 0,
      };
    }
  });
  return breakdown;
};

const summarizeHealthBreakdown = (breakdown: Record<string, { comfort: number; penalty: number; streak: number }>) => {
  const entries = Object.values(breakdown);
  if (entries.length === 0) {
    return { projectedPenalty: 0, worstStreak: 0, lowComfortLegs: 0, averageComfort: 0 };
  }
  const projectedPenalty = entries.reduce((sum, entry) => sum + Math.abs(entry.penalty), 0);
  const worstStreak = entries.reduce((max, entry) => Math.max(max, entry.streak), 0);
  const lowComfortLegs = entries.filter((entry) => entry.penalty < 0).length;
  const averageComfort = entries.reduce((sum, entry) => sum + entry.comfort, 0) / entries.length;
  return { projectedPenalty, worstStreak, lowComfortLegs, averageComfort };
};

const getCompletedLowComfortStreak = (tour: Tour | undefined, targetVenue: TourVenue) => {
  if (!tour) return 0;
  const sortedStops = [...(tour.venues || [])].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const targetTime = new Date(targetVenue.date).getTime();
  let streak = 0;
  for (const stop of sortedStops) {
    const stopTime = new Date(stop.date).getTime();
    if (stopTime >= targetTime) {
      break;
    }
    if (stop.status !== 'completed') {
      continue;
    }
    const comfort = getVenueComfort(stop);
    if (isLowComfortLeg(comfort)) {
      streak += 1;
    } else {
      streak = 0;
    }
  }
  return streak;
};

const getPreviousLocationForTour = (tour: Tour | undefined, targetDate?: string) => {
  if (!tour || !tour.venues?.length) {
    return undefined;
  }
  const sortedStops = [...tour.venues].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const targetTime = targetDate ? new Date(targetDate).getTime() : null;
  let previousLocation: string | undefined;
  for (const stop of sortedStops) {
    const stopTime = new Date(stop.date).getTime();
    if (targetTime !== null && stopTime >= targetTime) {
      break;
    }
    if (stop.venue?.location) {
      previousLocation = stop.venue.location;
    }
  }
  return previousLocation;
};

const computeDistanceForLeg = (
  tour: Tour | undefined,
  venueLocation?: string | null,
  targetDate?: string
) => {
  if (!venueLocation) {
    return 0;
  }
  const previousLocation = getPreviousLocationForTour(tour, targetDate);
  return calculateDistanceKm(previousLocation, venueLocation);
};

const calculateOptimalRoute = (tourVenues: TourVenue[]): RouteSuggestion => {
  const stops = (tourVenues || []).filter(Boolean);
  if (stops.length <= 1) {
    return { order: stops, totalDistance: 0 };
  }

  const remaining = [...stops].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const start = remaining.shift();
  if (!start) {
    return { order: [], totalDistance: 0 };
  }

  const optimalOrder: TourVenue[] = [start];
  let totalDistance = 0;

  while (remaining.length > 0) {
    const lastStop = optimalOrder[optimalOrder.length - 1];
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    remaining.forEach((candidate, index) => {
      const distance = calculateDistanceKm(lastStop.venue?.location, candidate.venue?.location);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    const nextStop = remaining.splice(bestIndex, 1)[0];
    if (!nextStop) {
      break;
    }

    if (Number.isFinite(bestDistance)) {
      totalDistance += bestDistance;
    }
    optimalOrder.push(nextStop);
  }

  return { order: optimalOrder, totalDistance };
};

const createEmptySchedule = (): VenueScheduleForm => ({
  venueId: "",
  date: "",
  ticketPrice: "",
  travelCost: "",
  lodgingCost: "",
  miscCost: "",
  travelMode: DEFAULT_TRAVEL_MODE,
});
const TourManager = () => {
  const { user } = useAuth();
  const { profile, skills, currentCity, updateProfile } = useGameData();
  const { toast } = useToast();
  const [tours, setTours] = useState<Tour[]>([]);
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingTour, setCreatingTour] = useState(false);
  const [ticketPriceUpdates, setTicketPriceUpdates] = useState<Record<string, string>>({});
  const [marketingSpendUpdates, setMarketingSpendUpdates] = useState<Record<string, string>>({});
  const [updatingVenue, setUpdatingVenue] = useState<string | null>(null);
  const [performingVenue, setPerformingVenue] = useState<string | null>(null);
  const [editingTourId, setEditingTourId] = useState<string | null>(null);
  const [editForms, setEditForms] = useState<Record<string, EditTourForm>>({});

  const [newTour, setNewTour] = useState({
    name: "",
    description: "",
    start_date: "",
    end_date: ""
  });
  const [venueSchedules, setVenueSchedules] = useState<Record<string, VenueScheduleForm>>({});
  const [cities, setCities] = useState<CityRow[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [venuesLoading, setVenuesLoading] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState<string>(currentCity?.id ?? ALL_CITIES_VALUE);
  const [citySelectionTouched, setCitySelectionTouched] = useState(false);
  const selectedCity = useMemo(
    () => cities.find((city) => city.id === selectedCityId),
    [cities, selectedCityId]
  );

  const supabaseClient = useMemo(() => supabase, []);

  useEffect(() => {
    if (currentCity?.id && !citySelectionTouched && selectedCityId === ALL_CITIES_VALUE) {
      setSelectedCityId(currentCity.id);
    }
  }, [citySelectionTouched, currentCity?.id, selectedCityId]);

  const normalizeDate = (date?: string | null) => (date ? date.split("T")[0] : "");

  const initializeEditForm = (tour: Tour): EditTourForm => ({
    start_date: normalizeDate(tour.start_date),
    end_date: normalizeDate(tour.end_date),
    status: tour.status || "planned",
    venues: (tour.venues || []).map((venue) => ({
      id: venue.id,
      venue_id: venue.venue_id,
      date: normalizeDate(venue.date),
      status: venue.status || "scheduled",
      ticket_price: venue.ticket_price
    })),
    newVenue: {
      venue_id: "",
      date: "",
      ticket_price: "",
      travel_mode: DEFAULT_TRAVEL_MODE,
    }
  });

  const tourStatusOptions = ['planned', 'active', 'completed', 'cancelled'];
  const venueStatusOptions = ['scheduled', 'completed', 'cancelled'];

  const loadTours = useCallback(async (): Promise<Tour[]> => {
    if (!user) return [];

    try {
      const { data, error } = await supabaseClient
        .from('tours')
        .select(`
          *,
          tour_venues!tour_venues_tour_id_fkey (
            *,
            venues!tour_venues_venue_id_fkey (name, location, capacity)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const mappedTours = (data || []).map((tour) => ({
        ...tour,
        venues: (tour.tour_venues || []).map((tv) => ({
          ...tv,
          travel_mode: normalizeTravelMode((tv as { travel_mode?: string | null }).travel_mode ?? null),
          travel_comfort: (tv as { travel_comfort?: number | null }).travel_comfort ?? null,
          venue: tv.venues,
          environment_modifiers: (tv as { environment_modifiers?: EnvironmentModifierSummary | null }).environment_modifiers ?? null,
        })),
      }));
      setTours(mappedTours);
      setTicketPriceUpdates({});
      setMarketingSpendUpdates({});
      return mappedTours;
    } catch (error: unknown) {
      const fallbackMessage = "Failed to load tours";
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error loading tours:', errorMessage, error);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage}: ${errorMessage}`
      });
      return [];
    }
  }, [user, supabaseClient, setTours, setTicketPriceUpdates, setMarketingSpendUpdates, toast]);

  const loadVenues = useCallback(async () => {
    setVenuesLoading(true);
    try {
      let query = supabaseClient
        .from('venues')
        .select('*');

      if (selectedCityId !== ALL_CITIES_VALUE) {
        query = query.eq('city_id', selectedCityId);
      }

      const { data, error } = await query
        .order('prestige_level', { ascending: true })
        .order('capacity', { ascending: true });

      if (error) throw error;
      setVenues(data || []);
    } catch (error: unknown) {
      console.error('Error loading venues:', error);
    } finally {
      setVenuesLoading(false);
      setLoading(false);
    }
  }, [selectedCityId, supabaseClient, setVenues, setLoading]);

  const loadCities = useCallback(async () => {
    setCitiesLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from('cities')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setCities((data ?? []) as CityRow[]);
    } catch (error: unknown) {
      const fallbackMessage = "Failed to load cities";
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error loading cities:', errorMessage, error);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage}: ${errorMessage}`,
      });
    } finally {
      setCitiesLoading(false);
    }
  }, [supabaseClient, toast]);

  useEffect(() => {
    loadCities();
  }, [loadCities]);

  useEffect(() => {
    if (user) {
      loadTours();
    }
  }, [user, loadTours]);

  useEffect(() => {
    if (user) {
      loadVenues();
    }
  }, [user, loadVenues]);

  useEffect(() => {
    const validVenueIds = new Set(venues.map((venue) => venue.id));

    setVenueSchedules((prev) => {
      let changed = false;
      const entries = Object.entries(prev).map(([tourId, schedule]) => {
        if (schedule.venueId && !validVenueIds.has(schedule.venueId)) {
          changed = true;
          return [tourId, { ...schedule, venueId: "" }];
        }
        return [tourId, schedule];
      });
      return changed ? Object.fromEntries(entries) as typeof prev : prev;
    });

    setEditForms((prev) => {
      let changed = false;
      const entries = Object.entries(prev).map(([tourId, form]) => {
        if (!form) {
          return [tourId, form];
        }
        const newVenueId = form.newVenue?.venue_id;
        if (newVenueId && !validVenueIds.has(newVenueId)) {
          changed = true;
          return [
            tourId,
            {
              ...form,
              newVenue: {
                ...form.newVenue,
                venue_id: "",
              },
            },
          ];
        }
        return [tourId, form];
      });
      return changed ? Object.fromEntries(entries) as typeof prev : prev;
    });
  }, [venues]);

  const optimalRoutes = useMemo(() => {
    const routes: Record<string, RouteSuggestion> = {};
    (tours || []).forEach((tour) => {
      const route = calculateOptimalRoute(tour.venues || []);
      if (route.order.length > 0) {
        routes[tour.id] = route;
      }
    });
    return routes;
  }, [tours]);

  const createTour = async () => {
    if (!user || !profile || !skills) return;

    try {
      setCreatingTour(true);

      // Check if player meets tour requirements
      const tourRequirements = { fame: 1000, performance: 50 };
      const { meets, missing } = meetsRequirements(tourRequirements, {
        fame: profile.fame,
        performance: skills.performance
      });

      if (!meets) {
        toast({
          variant: "destructive",
          title: "Requirements Not Met",
          description: `You need: ${missing.join(', ')}`
        });
        return;
      }

      const { data, error } = await supabase
        .from('tours')
        .insert({
          user_id: user.id,
          name: newTour.name,
          description: newTour.description,
          start_date: newTour.start_date,
          end_date: newTour.end_date,
          status: 'planned'
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Tour Created!",
        description: `${newTour.name} has been added to your tour schedule`
      });

      setNewTour({ name: "", description: "", start_date: "", end_date: "" });
      await loadTours();
    } catch (error: unknown) {
      console.error('Error creating tour:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create tour"
      });
    } finally {
      setCreatingTour(false);
    }
  };
  const addVenueToTour = async (tourId: string, details: NewTourVenueDetails) => {
    if (!user) return false;

    try {
      const selectedVenue = venues.find(venue => venue.id === details.venueId);
      const locationLabel = selectedVenue?.location ?? '';

      let environmentSummary: EnvironmentModifierSummary | null = null;
      try {
        environmentSummary = await fetchEnvironmentModifiers(locationLabel, details.date);
      } catch (envError) {
        console.error('Error fetching environment modifiers for tour stop:', envError);
      }

      const costMultiplier = environmentSummary?.costMultiplier ?? 1;
      const adjustedTravelCost = Math.max(0, Math.round(details.travelCost * costMultiplier));
      const adjustedLodgingCost = Math.max(0, Math.round(details.lodgingCost * costMultiplier));
      const adjustedMiscCost = Math.max(0, Math.round(details.miscCost * costMultiplier));
      const travelMode = details.travelMode ?? DEFAULT_TRAVEL_MODE;
      const travelComfort = typeof details.travelComfort === 'number'
        ? details.travelComfort
        : getTravelModeConfig(travelMode).comfort;

      const baseCapacity = selectedVenue?.capacity ?? 0;
      const baseProjectedAttendance = baseCapacity ? Math.max(1, Math.round(baseCapacity * 0.6)) : null;
      const projectedAttendance = baseProjectedAttendance
        ? Math.max(1, Math.round(baseProjectedAttendance * (environmentSummary?.attendanceMultiplier ?? 1)))
        : null;

      const insertPayload: TourVenueInsert = {
        tour_id: tourId,
        venue_id: details.venueId,
        date: details.date,
        ticket_price: details.ticketPrice,
        travel_cost: adjustedTravelCost,
        lodging_cost: adjustedLodgingCost,
        misc_cost: adjustedMiscCost,
        tickets_sold: 0,
        revenue: 0,
        status: 'scheduled',
        travel_time: typeof details.travelTime === 'number' ? details.travelTime : undefined,
        rest_days: typeof details.restDays === 'number' ? details.restDays : undefined,
        travel_mode: travelMode,
        travel_comfort: travelComfort,
      };

      let environmentForInsert: EnvironmentModifierSummary | null = null;
      if (environmentSummary) {
        environmentForInsert = {
          ...environmentSummary,
          projections: {
            attendance: projectedAttendance ?? undefined,
            travelCost: adjustedTravelCost,
            lodgingCost: adjustedLodgingCost,
            miscCost: adjustedMiscCost,
          },
        };
        insertPayload.environment_modifiers = environmentForInsert;
      }

      const { data: createdVenue, error } = await supabase
        .from('tour_venues')
        .insert(insertPayload)
        .select(`
          *,
          venues!tour_venues_venue_id_fkey (name, location, capacity)
        `)
        .single();

      if (error) throw error;

      const environmentFromDb = (createdVenue as { environment_modifiers?: EnvironmentModifierSummary | null }).environment_modifiers ?? environmentForInsert;

      if (createdVenue) {
        const selectedTour = tours.find(tour => tour.id === tourId);
        const venueDetails = createdVenue.venues || selectedVenue;
        const eventEnd = new Date(createdVenue.date);
        eventEnd.setHours(eventEnd.getHours() + 3);

        const environmentNotes = environmentFromDb?.applied?.length
          ? environmentFromDb.applied
              .map((effect) => {
                const summary = summarizeEnvironmentEffect(effect);
                return summary ? `${effect.name} (${summary})` : effect.name;
              })
              .join(' | ')
          : null;

        const scheduleDescriptionBase = selectedTour?.description ?? (venueDetails ? `Tour stop at ${venueDetails.name}` : 'Tour performance');
        const scheduleDescription = environmentNotes
          ? `${scheduleDescriptionBase} • Env: ${environmentNotes}`
          : scheduleDescriptionBase;

        const { error: scheduleError } = await supabase
          .from('schedule_events')
          .insert({
            user_id: user.id,
            event_type: 'tour',
            title: `${selectedTour?.name ?? 'Tour Show'}${venueDetails ? ` - ${venueDetails.name}` : ''}`,
            description: scheduleDescription,
            start_time: createdVenue.date,
            end_time: eventEnd.toISOString(),
            location: venueDetails?.location ?? 'TBA',
            status: 'scheduled',
            tour_venue_id: createdVenue.id
          });

        if (scheduleError) {
          console.error('Error adding tour stop to schedule:', scheduleError);
          toast({
            variant: "destructive",
            title: "Schedule update failed",
            description: "Tour stop added but the schedule couldn't be updated automatically."
          });
        }
      }

      const toastMessages = [
        selectedVenue ? `Added ${selectedVenue.name} to the tour.` : 'Tour venue scheduled.',
        projectedAttendance ? `Projected attendance ${projectedAttendance.toLocaleString()}.` : null,
        `Travel via ${getTravelModeConfig(travelMode).label} • ${Math.round(travelComfort)}% comfort.`,
      ];

      if (environmentFromDb?.applied?.length) {
        const summary = environmentFromDb.applied
          .map((effect) => summarizeEnvironmentEffect(effect))
          .filter(Boolean)
          .join(' | ');
        if (summary) {
          toastMessages.push(`Environment: ${summary}.`);
        }
      }

      toast({
        title: "Venue Added",

        description: toastMessages.filter(Boolean).join(' ')
      });

      await loadTours();
      return true;
    } catch (error: unknown) {
      console.error('Error adding venue to tour:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add venue to tour"
      });
      return false;
    }
  };

  const handleManageClick = (tour: Tour) => {
    if (editingTourId === tour.id) {
      setEditingTourId(null);
      setEditForms((prev) => {
        const updated = { ...prev };
        delete updated[tour.id];
        return updated;
      });
      return;
    }

    setEditForms((prev) => ({
      ...prev,
      [tour.id]: initializeEditForm(tour),
    }));
    setEditingTourId(tour.id);
  };

  const handleAddVenue = async (tourId: string) => {
    const form = editForms[tourId];
    if (!form) {
      toast({
        variant: "destructive",
        title: "No tour selected",
        description: "Open a tour for management before adding venues.",
      });
      return;
    }

    const { venue_id, date, ticket_price, travel_mode } = form.newVenue;
    if (!venue_id || !date) {
      toast({
        variant: "destructive",
        title: "Missing Details",
        description: "Select a venue and date before adding a tour stop.",
      });
      return;
    }

    const ticketPriceValue = parseCurrencyInput(ticket_price);
    let isoDate = date;
    if (!isoDate.includes("T")) {
      const parsed = new Date(date);
      if (!Number.isNaN(parsed.getTime())) {
        isoDate = parsed.toISOString();
      }
    }

    const tour = tours.find((item) => item.id === tourId);
    const selectedVenue = venues.find((venue) => venue.id === venue_id);
    const travelMode = travel_mode || DEFAULT_TRAVEL_MODE;
    const distance = computeDistanceForLeg(tour, selectedVenue?.location, isoDate);
    const travelPlan = buildTravelPlanMetrics(distance, travelMode);

    const success = await addVenueToTour(tourId, {
      venueId: venue_id,
      date: isoDate,
      ticketPrice: ticketPriceValue,
      travelMode,
      travelCost: travelPlan.travelCost,
      lodgingCost: travelPlan.lodgingCost,
      miscCost: travelPlan.miscCost,
      travelTime: travelPlan.travelTime,
      restDays: travelPlan.restDays,
      travelComfort: travelPlan.travelComfort,
    });

    if (success) {
      setEditForms((prev) => {
        const current = prev[tourId];
        if (!current) return prev;
        return {
          ...prev,
          [tourId]: {
            ...current,
            newVenue: {
              venue_id: "",
              date: "",
              ticket_price: "",
              travel_mode: DEFAULT_TRAVEL_MODE,
            },
          },
        };
      });
    }
  };

  const editTour = async (tourId: string) => {
    if (!user) return;
    const form = editForms[tourId];
    if (!form) {
      toast({
        variant: "destructive",
        title: "No changes detected",
        description: "Open a tour for management before saving changes.",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('tours')
        .update({
          start_date: form.start_date,
          end_date: form.end_date,
          status: form.status,
        })
        .eq('id', tourId)
        .eq('user_id', user.id);

      if (error) throw error;

      const updatedTours = await loadTours();
      const refreshedTour = updatedTours.find((tour) => tour.id === tourId);
      if (refreshedTour) {
        setEditForms((prev) => ({
          ...prev,
          [tourId]: initializeEditForm(refreshedTour),
        }));
      }

      toast({
        title: "Tour Updated",
        description: "Tour details saved successfully.",
      });

      setEditingTourId(null);
    } catch (error: unknown) {
      console.error('Error updating tour:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update tour",
      });
    }
  };

  const handleCancelEditing = (tourId: string) => {
    const currentTour = tours.find((tour) => tour.id === tourId);
    if (currentTour) {
      setEditForms((prev) => ({
        ...prev,
        [tourId]: initializeEditForm(currentTour),
      }));
    } else {
      setEditForms((prev) => {
        const updated = { ...prev };
        delete updated[tourId];
        return updated;
      });
    }
    setEditingTourId(null);
  };

  const cancelTour = async (tourId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('tours')
        .update({ status: 'cancelled' })
        .eq('id', tourId)
        .eq('user_id', user.id);
      if (error) throw error;

      const { error: venuesError } = await supabase
        .from('tour_venues')
        .update({ status: 'cancelled' })
        .eq('tour_id', tourId);

      if (venuesError) throw venuesError;

      toast({
        title: "Tour Cancelled",
        description: "The tour and all of its shows have been cancelled.",
      });

      setEditForms((prev) => {
        const updated = { ...prev };
        delete updated[tourId];
        return updated;
      });
      setEditingTourId(null);

      await loadTours();
    } catch (error: unknown) {
      console.error('Error cancelling tour:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to cancel tour",
      });
    }
  };

  const updateVenueSchedule = (tourId: string, field: keyof VenueScheduleForm, value: string) => {
    setVenueSchedules(prev => {
      const current = prev[tourId] ?? createEmptySchedule();
      return {
        ...prev,
        [tourId]: {
          ...current,
          [field]: value
        }
      };
    });
  };

  const parseCurrencyInput = (value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.round(parsed));
  };

  const handleScheduleVenue = async (tourId: string) => {
    const schedule = venueSchedules[tourId] ?? createEmptySchedule();

    if (!schedule.venueId || !schedule.date) {
      toast({
        variant: "destructive",
        title: "Missing Details",
        description: "Select a venue and date to schedule a show."
      });
      return;
    }

    const ticketPrice = parseCurrencyInput(schedule.ticketPrice);
    let isoDate = schedule.date;
    if (!schedule.date.includes('T')) {
      const parsedDate = new Date(schedule.date);
      if (!Number.isNaN(parsedDate.getTime())) {
        isoDate = parsedDate.toISOString();
      }
    }

    const tour = tours.find((item) => item.id === tourId);
    const selectedVenue = venues.find((venue) => venue.id === schedule.venueId);
    if (!selectedVenue) {
      toast({
        variant: "destructive",
        title: "Venue unavailable",
        description: "The selected venue could not be found.",
      });
      return;
    }

    const travelMode = schedule.travelMode || DEFAULT_TRAVEL_MODE;
    const distanceKm = computeDistanceForLeg(tour, selectedVenue.location, isoDate);
    const travelPlan = buildTravelPlanMetrics(distanceKm, travelMode);

    setVenueSchedules((prev) => ({
      ...prev,
      [tourId]: {
        ...schedule,
        travelCost: travelPlan.travelCost.toString(),
        lodgingCost: travelPlan.lodgingCost.toString(),
        miscCost: travelPlan.miscCost.toString(),
        travelMode,
      },
    }));

    const success = await addVenueToTour(tourId, {
      venueId: schedule.venueId,
      date: isoDate,
      ticketPrice,
      travelMode,
      travelCost: travelPlan.travelCost,
      lodgingCost: travelPlan.lodgingCost,
      miscCost: travelPlan.miscCost,
      travelTime: travelPlan.travelTime,
      restDays: travelPlan.restDays,
      travelComfort: travelPlan.travelComfort,
    });

    if (success) {
      setVenueSchedules(prev => ({
        ...prev,
        [tourId]: createEmptySchedule()
      }));
    }
  };

  const simulateTourShow = async (tourVenue: TourVenue) => {
    if (!user || !profile || !skills) return;

    const venueInfo = tourVenue.venue;
    if (!venueInfo) {
      toast({
        variant: "destructive",
        title: "Missing Venue Details",
        description: "Unable to simulate this show because venue information is incomplete."
      });
      return;
    }

    try {
      // Calculate show success based on skills and venue prestige
      const successRate = Math.min(0.9, skills.performance / 100);
      const capacity = venueInfo.capacity || 500;
      const environmentModifiers = tourVenue.environment_modifiers;
      const attendanceMultiplier = environmentModifiers?.attendanceMultiplier ?? 1;
      const moraleMultiplier = environmentModifiers?.moraleModifier ?? 1;

      const attendanceBase = Math.floor(capacity * (0.4 + successRate * 0.5));
      const attendance = Math.max(1, Math.round(attendanceBase * attendanceMultiplier));
      const ticketPrice = tourVenue.ticket_price ?? 25;
      const revenue = attendance * ticketPrice;
      const totalCosts = (tourVenue.travel_cost || 0) + (tourVenue.lodging_cost || 0) + (tourVenue.misc_cost || 0);
      const profit = revenue - totalCosts;
      const resolvedTour = tours.find((tourItem) => tourItem.id === tourVenue.tour_id) ?? tours.find((tourItem) => tourItem.venues?.some(v => v.id === tourVenue.id));
      const comfortValue = getVenueComfort(tourVenue);
      const previousLowComfortStreak = getCompletedLowComfortStreak(resolvedTour, tourVenue);
      const healthChange = isLowComfortLeg(comfortValue) ? computeHealthPenalty(comfortValue, previousLowComfortStreak + 1) : 0;
      const travelMode = normalizeTravelMode(tourVenue.travel_mode) ?? DEFAULT_TRAVEL_MODE;
      const modeConfig = getTravelModeConfig(travelMode);

      const updatedEnvironment = environmentModifiers
        ? {
            ...environmentModifiers,
            projections: {
              ...environmentModifiers.projections,
              attendance,
            },
          }
        : null;

      const updatePayload: TourVenueUpdate = {
        tickets_sold: attendance,
        revenue,
        status: 'completed',
        environment_modifiers: updatedEnvironment ?? tourVenue.environment_modifiers ?? null,
      };

      const { error } = await supabase
        .from('tour_venues')
        .update(updatePayload)
        .eq('id', tourVenue.id);

      if (error) throw error;

      // Update player cash and fame
      const fameGain = Math.max(0, Math.round((attendance / 10) * moraleMultiplier));
      const currentCash = profile.cash ?? 0;
      const currentFame = profile.fame ?? 0;
      const currentHealth = profile.health ?? 100;
      const nextHealth = Math.max(0, Math.min(100, currentHealth + healthChange));

      if (updateProfile) {
        await updateProfile({
          cash: currentCash + profit,
          fame: currentFame + fameGain,
          health: nextHealth,
        });
      } else {
        await supabase
          .from('profiles')
          .update({
            cash: currentCash + profit,
            fame: currentFame + fameGain,
            health: nextHealth,
          })
          .eq('user_id', user.id);
      }

      let profitDescription = "break-even result";
      if (profit > 0) {
        profitDescription = `profit of $${profit.toLocaleString()}`;
      } else if (profit < 0) {
        profitDescription = `loss of $${Math.abs(profit).toLocaleString()}`;
      }

      const healthMessage = healthChange < 0
        ? ` Health decreased by ${Math.abs(healthChange)} due to the ${comfortValue.toFixed(0)}% comfort ${modeConfig.label.toLowerCase()} leg.`
        : '';

      toast({
        title: "Show Complete!",
        description: `Great performance! Earned $${revenue.toLocaleString()} revenue with $${totalCosts.toLocaleString()} costs, resulting in a ${profitDescription} and ${fameGain} fame.${healthMessage}`

      });

      await loadTours();
    } catch (error: unknown) {
      console.error('Error simulating tour show:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to complete show"
      });
    } finally {
      setPerformingVenue(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-success border-success bg-success/10';
      case 'active': return 'text-warning border-warning bg-warning/10';
      case 'cancelled': return 'text-destructive border-destructive bg-destructive/10';
      default: return 'text-primary border-primary bg-primary/10';
    }
  };

  function formatEnvironmentDelta(value?: number, label?: string) {
    if (!value || value === 1 || !label) {
      return null;
    }

    const percent = Math.round((value - 1) * 100);
    if (percent === 0) {
      return null;
    }

    const sign = percent > 0 ? '+' : '';
    return `${label} ${sign}${percent}%`;
  }

  function summarizeEnvironmentEffect(effect: AppliedEnvironmentEffect) {
    const changes = [
      formatEnvironmentDelta(effect.attendanceMultiplier, 'Attendance'),
      formatEnvironmentDelta(effect.costMultiplier, 'Costs'),
      formatEnvironmentDelta(effect.moraleModifier, 'Morale'),
    ].filter(Boolean);

    return changes.join(' • ');
  }

  const calculateTourStats = (tour: Tour) => {
    const totalRevenue = tour.venues?.reduce((sum, v) => sum + (v.revenue || 0), 0) || 0;
    const totalCosts = tour.venues?.reduce((sum, v) => sum + (v.travel_cost || 0) + (v.lodging_cost || 0) + (v.misc_cost || 0), 0) || 0;
    const totalProfit = totalRevenue - totalCosts;
    const totalTickets = tour.venues?.reduce((sum, v) => sum + (v.tickets_sold || 0), 0) || 0;
    const completedShows = tour.venues?.filter(v => v.status === 'completed').length || 0;
    const totalShows = tour.venues?.length || 0;
    const totalTravelHours = tour.venues?.reduce((sum, v) => sum + (typeof v.travel_time === 'number' ? v.travel_time : Number(v.travel_time || 0)), 0) || 0;
    const totalRestDays = tour.venues?.reduce((sum, v) => sum + (typeof v.rest_days === 'number' ? v.rest_days : Number(v.rest_days || 0)), 0) || 0;
    const healthBreakdown = computeTourHealthBreakdown(tour);
    const healthSummary = summarizeHealthBreakdown(healthBreakdown);
    return {
      totalRevenue,
      totalCosts,
      totalProfit,
      totalTickets,
      completedShows,
      totalShows,
      totalTravelHours,
      totalRestDays,
      averageComfort: healthSummary.averageComfort,
      lowComfortLegs: healthSummary.lowComfortLegs,
      projectedHealthPenalty: healthSummary.projectedPenalty,
      worstLowComfortStreak: healthSummary.worstStreak,
      healthBreakdown,
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-oswald">Loading tour management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bebas tracking-wider bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
              Tour Manager
            </h1>
            <p className="text-muted-foreground font-oswald">Plan and manage your concert tours</p>
          </div>
          <Button 
            onClick={() => setCreatingTour(true)}
            className="bg-gradient-primary hover:shadow-electric"
            disabled={!profile || profile.fame < 1000}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Tour
          </Button>
        </div>

        {/* Requirements Check */}
        {profile && profile.fame < 1000 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You need at least 1,000 fame and 50 performance skill to create tours.
              Current fame: {profile.fame}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold font-oswald">Plan by city</h2>
            <p className="text-sm text-muted-foreground">
              Filter venue availability to focus your routing strategy.
            </p>
          </div>
          <Select
            value={selectedCityId}
            onValueChange={(value) => {
              setCitySelectionTouched(true);
              setSelectedCityId(value);
            }}
            disabled={citiesLoading || (cities.length === 0 && selectedCityId !== ALL_CITIES_VALUE)}
          >
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Select a city" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CITIES_VALUE}>All Cities</SelectItem>
              {cities.map((city) => (
                <SelectItem key={city.id} value={city.id}>
                  {city.name}
                  {city.id === currentCity?.id ? " (Current)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {venuesLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-primary"></div>
            Loading venues...
          </div>
        ) : venues.length === 0 ? (
          <Alert className="bg-card/70 backdrop-blur-sm border-primary/20">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No venues available</AlertTitle>
            <AlertDescription>
              {selectedCityId === ALL_CITIES_VALUE
                ? "There are no venues available right now. Try again later or unlock more locations."
                : `No venues are currently open for bookings in ${selectedCity?.name ?? "this city"}. Choose another city or check back soon.`}
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Create Tour Form */}
        {creatingTour && (
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle>Create New Tour</CardTitle>
              <CardDescription>Plan your multi-city tour</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tour-name">Tour Name</Label>
                  <Input
                    id="tour-name"
                    value={newTour.name}
                    onChange={(e) => setNewTour({ ...newTour, name: e.target.value })}
                    placeholder="World Domination Tour"
                  />
                </div>
                <div>
                  <Label htmlFor="tour-description">Description</Label>
                  <Input
                    id="tour-description"
                    value={newTour.description}
                    onChange={(e) => setNewTour({ ...newTour, description: e.target.value })}
                    placeholder="Epic tour across multiple cities"
                  />
                </div>
                <div>
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={newTour.start_date}
                    onChange={(e) => setNewTour({ ...newTour, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={newTour.end_date}
                    onChange={(e) => setNewTour({ ...newTour, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={createTour}
                  disabled={!newTour.name || !newTour.start_date || !newTour.end_date}
                >
                  Create Tour
                </Button>
                <Button variant="outline" onClick={() => setCreatingTour(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tours List */}
        <div className="space-y-4">
          {tours.length > 0 ? tours.map((tour) => {
            const stats = calculateTourStats(tour);
            const schedule = venueSchedules[tour.id] ?? createEmptySchedule();
            const profitColor = stats.totalProfit >= 0 ? "text-success" : "text-destructive";
            const formattedNetProfit = stats.totalProfit >= 0
              ? `+$${stats.totalProfit.toLocaleString()}`
              : `-$${Math.abs(stats.totalProfit).toLocaleString()}`;
            const routeSuggestion = optimalRoutes[tour.id];
            const editForm = editForms[tour.id];
            const scheduleVenue = schedule.venueId ? venues.find((option) => option.id === schedule.venueId) : null;
            const scheduleIsoDate = schedule.date ? (() => {
              const parsed = new Date(schedule.date);
              return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
            })() : undefined;
            const scheduleMode = schedule.travelMode || DEFAULT_TRAVEL_MODE;
            const schedulePlan = scheduleVenue
              ? buildTravelPlanMetrics(
                  computeDistanceForLeg(tour, scheduleVenue?.location, scheduleIsoDate),
                  scheduleMode
                )
              : null;
            const scheduleModeConfig = getTravelModeConfig(scheduleMode);
            return (
              <Card key={tour.id} className="bg-card/80 backdrop-blur-sm border-primary/20">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Plane className="h-5 w-5 text-primary" />
                        {tour.name}
                      </CardTitle>
                      <CardDescription>{tour.description}</CardDescription>
                    </div>
                    <Badge variant="outline" className={getStatusColor(tour.status || 'planned')}>
                      {tour.status || 'planned'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Tour Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-success">${stats.totalRevenue.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Total Revenue</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-destructive">${stats.totalCosts.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Total Costs</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-2xl font-bold ${profitColor}`}>{formattedNetProfit}</p>
                      <p className="text-xs text-muted-foreground">Net Profit</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">{stats.totalTickets.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Tickets Sold</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-warning">{stats.completedShows}/{stats.totalShows}</p>
                      <p className="text-xs text-muted-foreground">Shows Completed</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">{stats.totalTravelHours.toFixed(1)}h</p>
                      <p className="text-xs text-muted-foreground">Travel Time</p>
                      <p className="text-xs text-muted-foreground">{stats.totalRestDays} rest day{stats.totalRestDays === 1 ? '' : 's'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-sky-500">{Math.round(stats.averageComfort || 0)}%</p>
                      <p className="text-xs text-muted-foreground">Avg Travel Comfort</p>
                      <p className="text-xs text-muted-foreground">{stats.lowComfortLegs} low-comfort leg{stats.lowComfortLegs === 1 ? '' : 's'}</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-2xl font-bold ${stats.projectedHealthPenalty > 0 ? 'text-destructive' : 'text-success'}`}>
                        {stats.projectedHealthPenalty > 0 ? `-${stats.projectedHealthPenalty} HP` : 'Stable'}
                      </p>
                      <p className="text-xs text-muted-foreground">Projected Health Impact</p>
                      <p className="text-xs text-muted-foreground">
                        {stats.worstLowComfortStreak > 1
                          ? `Streak risk x${stats.worstLowComfortStreak}`
                          : describeComfort(stats.averageComfort || 0)}
                      </p>
                    </div>
                  </div>

                  {/* Schedule Show */}
                  <div className="space-y-3 p-4 border border-dashed border-primary/20 rounded-lg bg-secondary/20">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Plus className="h-4 w-4 text-primary" />
                      Schedule New Show
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <Label htmlFor={`venue-${tour.id}`}>Venue</Label>
                        <Select
                          value={schedule.venueId}
                          onValueChange={(value) => updateVenueSchedule(tour.id, "venueId", value === "no-venues" ? "" : value)}
                          disabled={venuesLoading || venues.length === 0}
                        >
                          <SelectTrigger id={`venue-${tour.id}`}>
                            <SelectValue
                              placeholder={
                                venuesLoading
                                  ? "Loading venues..."
                                  : venues.length
                                    ? "Choose a venue"
                                    : "No venues available"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {venues.length > 0 ? (
                              venues.map((option) => (
                                <SelectItem key={option.id} value={option.id}>
                                  {option.name} • {option.location}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="no-venues" disabled>
                                No venues available
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor={`date-${tour.id}`}>Date</Label>
                        <Input
                          id={`date-${tour.id}`}
                          type="date"
                          value={schedule.date}
                          onChange={(e) => updateVenueSchedule(tour.id, "date", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`ticket-${tour.id}`}>Ticket Price</Label>
                        <Input
                          id={`ticket-${tour.id}`}
                          type="number"
                          min={0}
                          value={schedule.ticketPrice}
                          onChange={(e) => updateVenueSchedule(tour.id, "ticketPrice", e.target.value)}
                          placeholder="50"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`mode-${tour.id}`}>Travel Mode</Label>
                        <Select
                          value={scheduleMode}
                          onValueChange={(value) => updateVenueSchedule(tour.id, "travelMode", value as TravelMode)}
                        >
                          <SelectTrigger id={`mode-${tour.id}`}>
                            <SelectValue placeholder="Select mode" />
                          </SelectTrigger>
                          <SelectContent>
                            {TRAVEL_MODE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label} • {Math.round(option.comfort)}% comfort
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          {scheduleModeConfig.description}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label htmlFor={`travel-${tour.id}`}>Travel Cost</Label>
                        <Input
                          id={`travel-${tour.id}`}
                          type="number"
                          min={0}
                          value={schedule.travelCost}
                          onChange={(e) => updateVenueSchedule(tour.id, "travelCost", e.target.value)}
                          placeholder={schedulePlan ? schedulePlan.travelCost.toString() : "0"}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`lodging-${tour.id}`}>Lodging Cost</Label>
                        <Input
                          id={`lodging-${tour.id}`}
                          type="number"
                          min={0}
                          value={schedule.lodgingCost}
                          onChange={(e) => updateVenueSchedule(tour.id, "lodgingCost", e.target.value)}
                          placeholder={schedulePlan ? schedulePlan.lodgingCost.toString() : "0"}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`misc-${tour.id}`}>Misc Cost</Label>
                        <Input
                          id={`misc-${tour.id}`}
                          type="number"
                          min={0}
                          value={schedule.miscCost}
                          onChange={(e) => updateVenueSchedule(tour.id, "miscCost", e.target.value)}
                          placeholder={schedulePlan ? schedulePlan.miscCost.toString() : "0"}
                        />
                      </div>
                    </div>
                    {schedulePlan && (
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
                        <span>Distance {Math.round(schedulePlan.distanceKm).toLocaleString()} km</span>
                        <span>~{schedulePlan.travelTime.toFixed(1)}h travel</span>
                        <span>Cost ${schedulePlan.travelCost.toLocaleString()}</span>
                        <span>
                          Comfort {Math.round(schedulePlan.travelComfort)}% ({describeComfort(schedulePlan.travelComfort)})
                        </span>
                        <span>{schedulePlan.restDays} rest day{schedulePlan.restDays === 1 ? '' : 's'}</span>
                      </div>
                    )}
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => handleScheduleVenue(tour.id)}
                        disabled={!schedule.venueId || !schedule.date || venuesLoading || venues.length === 0}
                      >
                        Schedule Show
                      </Button>
                    </div>
                  </div>

                  {routeSuggestion && routeSuggestion.order.length > 1 && (
                    <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-1">
                      <p className="text-sm font-semibold flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        Optimal Route Suggestion
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {routeSuggestion.order
                          .map((stop, index) => `${index + 1}. ${stop.venue?.name ?? 'Unknown Venue'} (${stop.venue?.location ?? 'TBD'})`)
                          .join(' → ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Estimated travel: {Math.round(routeSuggestion.totalDistance)} km total
                      </p>
                    </div>
                  )}

                  {editingTourId === tour.id && editForm && (
                    <div className="rounded-lg border border-border/40 bg-secondary/20 p-4 space-y-4">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div>
                          <Label className="text-xs uppercase text-muted-foreground">Start Date</Label>
                          <Input
                            type="date"
                            value={editForm.start_date}
                            onChange={(e) =>
                              setEditForms((prev) => {
                                const current = prev[tour.id];
                                if (!current) return prev;
                                return {
                                  ...prev,
                                  [tour.id]: {
                                    ...current,
                                    start_date: e.target.value
                                  }
                                };
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs uppercase text-muted-foreground">End Date</Label>
                          <Input
                            type="date"
                            value={editForm.end_date}
                            onChange={(e) =>
                              setEditForms((prev) => {
                                const current = prev[tour.id];
                                if (!current) return prev;
                                return {
                                  ...prev,
                                  [tour.id]: {
                                    ...current,
                                    end_date: e.target.value
                                  }
                                };
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs uppercase text-muted-foreground">Status</Label>
                          <select
                            className="mt-1 w-full rounded-md border border-border bg-background/80 px-3 py-2 text-sm capitalize focus:outline-none focus:ring-2 focus:ring-primary"
                            value={editForm.status}
                            onChange={(e) =>
                              setEditForms((prev) => {
                                const current = prev[tour.id];
                                if (!current) return prev;
                                return {
                                  ...prev,
                                  [tour.id]: {
                                    ...current,
                                    status: e.target.value
                                  }
                                };
                              })
                            }
                          >
                            {tourStatusOptions.map((status) => (
                              <option key={status} value={status}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h5 className="font-semibold text-sm">Add New Tour Stop</h5>
                        <div className="grid gap-3 md:grid-cols-4">
                          <div>
                            <Label className="text-xs uppercase text-muted-foreground">Venue</Label>
                            <select
                              className="mt-1 w-full rounded-md border border-border bg-background/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              value={editForm.newVenue.venue_id}
                              onChange={(e) =>
                                setEditForms((prev) => {
                                  const current = prev[tour.id];
                                  if (!current) return prev;
                                  return {
                                    ...prev,
                                    [tour.id]: {
                                      ...current,
                                      newVenue: {
                                        ...current.newVenue,
                                        venue_id: e.target.value
                                      }
                                    }
                                  };
                                })
                              }
                            >
                              <option value="">Select venue</option>
                              {venues.map((venueOption) => (
                                <option key={venueOption.id} value={venueOption.id}>
                                  {venueOption.name} • {venueOption.location}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label className="text-xs uppercase text-muted-foreground">Date</Label>
                            <Input
                              type="date"
                              value={editForm.newVenue.date}
                              onChange={(e) =>
                                setEditForms((prev) => {
                                  const current = prev[tour.id];
                                  if (!current) return prev;
                                  return {
                                    ...prev,
                                    [tour.id]: {
                                      ...current,
                                      newVenue: {
                                        ...current.newVenue,
                                        date: e.target.value
                                      }
                                    }
                                  };
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs uppercase text-muted-foreground">Ticket Price</Label>
                            <Input
                              type="number"
                              min="0"
                              value={editForm.newVenue.ticket_price}
                              onChange={(e) =>
                                setEditForms((prev) => {
                                  const current = prev[tour.id];
                                  if (!current) return prev;
                                  return {
                                    ...prev,
                                    [tour.id]: {
                                      ...current,
                                      newVenue: {
                                        ...current.newVenue,
                                        ticket_price: e.target.value
                                      }
                                    }
                                  };
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs uppercase text-muted-foreground">Travel Mode</Label>
                            <select
                              className="mt-1 w-full rounded-md border border-border bg-background/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              value={editForm.newVenue.travel_mode}
                              onChange={(e) =>
                                setEditForms((prev) => {
                                  const current = prev[tour.id];
                                  if (!current) return prev;
                                  return {
                                    ...prev,
                                    [tour.id]: {
                                      ...current,
                                      newVenue: {
                                        ...current.newVenue,
                                        travel_mode: e.target.value as TravelMode
                                      }
                                    }
                                  };
                                })
                              }
                            >
                              {TRAVEL_MODE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label} • {Math.round(option.comfort)}% comfort
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <Button size="sm" onClick={() => handleAddVenue(tour.id)}>
                          Add Venue
                        </Button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => editTour(tour.id)}>
                          Save Changes
                        </Button>
                        <Button variant="outline" onClick={() => handleCancelEditing(tour.id)}>
                          Cancel
                        </Button>
                        <Button variant="destructive" onClick={() => cancelTour(tour.id)}>
                          Cancel Tour
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Tour Dates */}
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Tour Dates ({tour.venues?.length || 0})
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {tour.venues && tour.venues.length > 0 ? (
                        tour.venues.map((venue) => {
                          const travelCost = venue.travel_cost || 0;
                          const lodgingCost = venue.lodging_cost || 0;
                          const miscCost = venue.misc_cost || 0;
                          const showRevenue = venue.revenue || 0;
                          const showCosts = travelCost + lodgingCost + miscCost;
                          const showProfit = showRevenue - showCosts;
                          const showProfitColor = showProfit >= 0 ? "text-success" : "text-destructive";
                          const travelTimeValue = typeof venue.travel_time === 'number' ? venue.travel_time : Number(venue.travel_time || 0);
                          const restDaysValue = typeof venue.rest_days === 'number' ? venue.rest_days : Number(venue.rest_days || 0);
                          const formattedTravelTime = Math.round(travelTimeValue * 10) / 10;
                          const mode = venue.travel_mode || DEFAULT_TRAVEL_MODE;
                          const normalizedMode = normalizeTravelMode(mode) ?? DEFAULT_TRAVEL_MODE;
                          const modeConfig = getTravelModeConfig(normalizedMode);
                          const healthInfo = stats.healthBreakdown?.[venue.id];
                          const comfortValue = healthInfo?.comfort ?? getVenueComfort(venue);
                          const comfortLabel = describeComfort(comfortValue);
                          const healthPenalty = healthInfo?.penalty ?? 0;
                          const healthText = healthPenalty < 0 ? `${healthPenalty} HP` : 'Stable';
                          const healthClass = healthPenalty < 0 ? 'text-destructive' : 'text-muted-foreground';

                          return (
                            <div key={venue.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                              <div className="flex-1 space-y-1">
                                <p className="font-medium">{venue.venue?.name ?? "Unknown Venue"}</p>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {venue.venue?.location ?? "Location TBD"} • {new Date(venue.date).toLocaleDateString()}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {venue.tickets_sold ?? 0}/{venue.venue?.capacity ?? 0} tickets • ${venue.ticket_price ?? 0} each
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Costs: ${showCosts.toLocaleString()} (Travel ${travelCost.toLocaleString()} • Lodging ${lodgingCost.toLocaleString()} • Misc ${miscCost.toLocaleString()})
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Travel: {modeConfig.label} • {formattedTravelTime || 0}h • Comfort {Math.round(comfortValue)}% ({comfortLabel})
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Rest: {restDaysValue} day{restDaysValue === 1 ? '' : 's'}
                                </p>
                                {venue.environment_modifiers?.projections?.attendance && (
                                  <p className="text-xs text-muted-foreground">
                                    Projected attendance: {venue.environment_modifiers.projections.attendance.toLocaleString()}
                                  </p>
                                )}
                                {venue.environment_modifiers?.applied?.length ? (
                                  <p className="text-xs text-muted-foreground">
                                    Environment: {
                                      venue.environment_modifiers.applied
                                        .map((effect) => {
                                          const summary = summarizeEnvironmentEffect(effect);
                                          return summary ? `${effect.name} (${summary})` : effect.name;
                                        })
                                        .join(' | ')
                                    }
                                  </p>
                                ) : null}
                                <p className={`text-xs font-semibold ${showProfitColor}`}>
                                  Profit: ${showProfit.toLocaleString()}
                                </p>
                                <p className={`text-xs font-semibold ${healthClass}`}>
                                  Health impact: {healthText}
                                  {healthInfo?.streak && healthInfo.streak > 1 ? ` (streak x${healthInfo.streak})` : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{modeConfig.label}</Badge>
                                <Badge variant="outline" className={getStatusColor(venue.status)}>
                                  {venue.status}
                                </Badge>
                                {venue.status === 'scheduled' && (
                                  <Button
                                    size="sm"
                                    onClick={() => simulateTourShow(venue)}
                                    disabled={!venue.venue}
                                  >
                                    Perform
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-center text-muted-foreground py-4">
                          No venues added to this tour yet
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-border/50">
                    <div className="flex flex-col md:flex-row md:items-center gap-2 text-sm text-muted-foreground">
                      <span>{new Date(tour.start_date).toLocaleDateString()} - {new Date(tour.end_date).toLocaleDateString()}</span>
                      <span className={`font-semibold ${profitColor}`}>
                        Net Profit: {formattedNetProfit}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleManageClick(tour)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      {editingTourId === tour.id ? "Close" : "Manage"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          }) : (
            <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
              <CardContent className="text-center py-12">
                <Plane className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Tours Planned</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first tour to perform across multiple cities
                </p>
                <Button 
                  onClick={() => setCreatingTour(true)}
                  disabled={!profile || profile.fame < 1000}
                >
                  Plan Your First Tour
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default TourManager;
