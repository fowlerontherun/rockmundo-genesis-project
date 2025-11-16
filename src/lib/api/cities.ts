import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase-client";

export interface CityCoordinate {
  lat: number;
  lng: number;
}

export interface CityVenue {
  id: string;
  cityId: string;
  name: string;
  venueType: string | null;
  capacity: number | null;
  prestigeLevel: number | null;
  location?: string | null;
  audienceType?: string | null;
  coordinates?: CityCoordinate | null;
  district?: string | null;
}

export interface CityEvent {
  id: string;
  cityId?: string | null;
  title: string;
  description?: string | null;
  type: string;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  impact?: string | null;
  metadata?: Record<string, unknown> | null;
  coordinates?: CityCoordinate | null;
}

interface UseCityResourceOptions {
  enabled?: boolean;
}

interface UseCityEventsOptions extends UseCityResourceOptions {
  fallbackCulturalEvents?: string[];
  cityName?: string;
}

interface FetchCityEventsOptions {
  fallbackCulturalEvents?: string[];
  cityName?: string;
}

interface FallbackEventConfig {
  id: string;
  title: string;
  description: string;
  type: string;
  durationDays: number;
}

const FALLBACK_VENUES: Array<Omit<CityVenue, "cityId">> = [
  {
    id: "fallback-venue-1",
    name: "Downtown Amphitheatre",
    venueType: "amphitheatre",
    capacity: 12500,
    prestigeLevel: 7,
    location: "Downtown district",
    audienceType: "Mainstream",
    coordinates: null,
    district: "Downtown",
  },
  {
    id: "fallback-venue-2",
    name: "Riverside Night Club",
    venueType: "club",
    capacity: 1200,
    prestigeLevel: 5,
    location: "Riverside arts quarter",
    audienceType: "Electronic",
    coordinates: null,
    district: "Riverside",
  },
  {
    id: "fallback-venue-3",
    name: "Old Town Theatre",
    venueType: "theatre",
    capacity: 2800,
    prestigeLevel: 6,
    location: "Old town cultural square",
    audienceType: "Indie",
    coordinates: null,
    district: "Old Town",
  },
];

const FALLBACK_EVENTS: FallbackEventConfig[] = [
  {
    id: "fallback-event-1",
    title: "Showcase Week",
    description: "A curated run of rising artists pulling media attention into {{city}} for seven nights.",
    type: "showcase",
    durationDays: 7,
  },
  {
    id: "fallback-event-2",
    title: "Underground Producer Summit",
    description: "Workshops, collaborations, and late-night sessions attracting tastemakers across {{city}}.",
    type: "summit",
    durationDays: 3,
  },
];

const parseNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseCoordinatesFromLocation = (location?: string | null): CityCoordinate | null => {
  if (!location) {
    return null;
  }

  const match = location.match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }

  const lat = Number(match[1]);
  const lng = Number(match[2]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
};

const extractCoordinatesFromMetadata = (metadata: Record<string, unknown> | null | undefined): CityCoordinate | null => {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const attempt = (candidate: unknown): CityCoordinate | null => {
    if (!candidate || typeof candidate !== "object") {
      return null;
    }

    const lat = parseNumber((candidate as Record<string, unknown>).lat ?? (candidate as Record<string, unknown>).latitude);
    const lng = parseNumber((candidate as Record<string, unknown>).lng ?? (candidate as Record<string, unknown>).longitude);

    if (lat === null || lng === null) {
      return null;
    }

    return { lat, lng };
  };

  const direct = attempt(metadata);
  if (direct) {
    return direct;
  }

  if ("coordinates" in metadata) {
    const nested = attempt((metadata as Record<string, unknown>).coordinates);
    if (nested) {
      return nested;
    }
  }

  if ("location" in metadata) {
    const nested = attempt((metadata as Record<string, unknown>).location);
    if (nested) {
      return nested;
    }
  }

  if ("position" in metadata) {
    const nested = attempt((metadata as Record<string, unknown>).position);
    if (nested) {
      return nested;
    }
  }

  return null;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isSchemaCacheMissingTableError = (error: unknown, tableName: string): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const details = (error as { details?: string }).details;
  const message = (error as { message?: string }).message;

  return (
    (typeof details === "string" && details.includes(`relation "${tableName}"`)) ||
    (typeof message === "string" &&
      (message.includes(`relation "${tableName}"`) || message.includes(`table "${tableName}"`)))
  );
};

const createFallbackVenues = (cityId: string): CityVenue[] =>
  FALLBACK_VENUES.map((venue, index) => ({
    ...venue,
    id: `${cityId}-${venue.id}-${index}`,
    cityId,
  }));

const createFallbackEvents = (
  cityId: string,
  options: FetchCityEventsOptions,
): CityEvent[] => {
  if (options.fallbackCulturalEvents && options.fallbackCulturalEvents.length > 0) {
    return options.fallbackCulturalEvents.map((title, index) => ({
      id: `${cityId}-cultural-${index}`,
      cityId,
      title,
      description: options.cityName
        ? `${title} keeps ${options.cityName} buzzing with fans and industry attention.`
        : `${title} keeps the city buzzing with fans and industry attention.`,
      type: "cultural_event",
      startDate: new Date().toISOString(),
      endDate: null,
      isActive: true,
      impact: "cultural",
      metadata: { source: "cultural_events" },
      coordinates: null,
    }));
  }

  return FALLBACK_EVENTS.map((event, index) => {
    const baseDescription = event.description.replace(
      "{{city}}",
      options.cityName ?? "the city",
    );

    return {
      id: `${cityId}-${event.id}-${index}`,
      cityId,
      title: options.cityName ? `${options.cityName} ${event.title}` : event.title,
      description: baseDescription,
      type: event.type,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + event.durationDays * 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
      impact: "cultural",
      metadata: { source: "fallback" },
      coordinates: null,
    } satisfies CityEvent;
  });
};

export const fetchCityVenues = async (cityId: string): Promise<CityVenue[]> => {
  const { data, error } = await supabase
    .from("venues")
    .select(
      "id, city_id, name, venue_type, capacity, prestige_level, audience_type, location, district:city_districts(name)",
    )
    .eq("city_id", cityId)
    .order("prestige_level", { ascending: false });

  if (error) {
    if (isSchemaCacheMissingTableError(error, "venues")) {
      return createFallbackVenues(cityId);
    }

    throw error;
  }

  const records = Array.isArray(data) ? data : [];

  return records.map((raw, index) => {
    if (!isRecord(raw)) {
      return {
        ...FALLBACK_VENUES[index % FALLBACK_VENUES.length],
        id: `${cityId}-venue-${index}`,
        cityId,
      } satisfies CityVenue;
    }

    const districtRecord = isRecord(raw.district) ? raw.district : null;
    const location = typeof raw.location === "string" ? raw.location : null;

    return {
      id: typeof raw.id === "string" ? raw.id : `${cityId}-venue-${index}`,
      cityId: typeof raw.city_id === "string" ? raw.city_id : cityId,
      name: typeof raw.name === "string" ? raw.name : "Untitled venue",
      venueType: typeof raw.venue_type === "string" ? raw.venue_type : null,
      capacity: parseNumber(raw.capacity),
      prestigeLevel: parseNumber(raw.prestige_level),
      location,
      audienceType: typeof raw.audience_type === "string" ? raw.audience_type : null,
      coordinates: parseCoordinatesFromLocation(location),
      district: districtRecord && typeof districtRecord.name === "string" ? districtRecord.name : null,
    } satisfies CityVenue;
  });
};

export const fetchCityEvents = async (
  cityId: string,
  options: FetchCityEventsOptions = {},
): Promise<CityEvent[]> => {
  const { fallbackCulturalEvents = [], cityName } = options;

  const { data, error } = await supabase
    .from("world_events" as never)
    .select("id, title, description, type, start_date, end_date, is_active, affected_cities, metadata")
    .order("start_date", { ascending: true });

  if (error) {
    if (isSchemaCacheMissingTableError(error, "world_events")) {
      return createFallbackEvents(cityId, { fallbackCulturalEvents, cityName });
    }

    throw error;
  }

  const records = Array.isArray(data) ? data : [];
  const now = Date.now();

  const events: CityEvent[] = records
    .filter((raw) => {
      if (!isRecord(raw)) {
        return false;
      }

      const affected = Array.isArray(raw.affected_cities)
        ? raw.affected_cities.filter((entry): entry is string => typeof entry === "string")
        : [];

      if (affected.includes(cityId)) {
        return true;
      }

      const metadata = isRecord(raw.metadata) ? raw.metadata : null;
      const metadataCity = metadata?.city_id ?? metadata?.cityId ?? metadata?.city;

      return typeof metadataCity === "string" && metadataCity.toLowerCase() === cityId.toLowerCase();
    })
    .map((raw, index) => {
      if (!isRecord(raw)) {
        return createFallbackEvents(cityId, { fallbackCulturalEvents, cityName })[index % FALLBACK_EVENTS.length];
      }

      const metadata = isRecord(raw.metadata) ? (raw.metadata as Record<string, unknown>) : null;
      const startDate = typeof raw.start_date === "string" ? raw.start_date : null;
      const endDate = typeof raw.end_date === "string" ? raw.end_date : null;
      const computedActive = endDate ? Date.parse(endDate) > now : true;
      const isActive = typeof raw.is_active === "boolean" ? raw.is_active : computedActive;

      return {
        id: typeof raw.id === "string" ? raw.id : `${cityId}-event-${index}`,
        cityId,
        title: typeof raw.title === "string" ? raw.title : "World event",
        description: typeof raw.description === "string" ? raw.description : null,
        type: typeof raw.type === "string" ? raw.type : "world_event",
        startDate,
        endDate,
        isActive,
        impact: typeof metadata?.impact === "string" ? (metadata.impact as string) : null,
        metadata,
        coordinates: extractCoordinatesFromMetadata(metadata),
      } satisfies CityEvent;
    });

  if (events.length > 0) {
    return events;
  }

  if (fallbackCulturalEvents.length > 0) {
    return createFallbackEvents(cityId, { fallbackCulturalEvents, cityName });
  }

  return createFallbackEvents(cityId, { fallbackCulturalEvents, cityName });
};

export const useCityVenues = (cityId?: string, options: UseCityResourceOptions = {}) =>
  useQuery({
    queryKey: ["city-venues", cityId],
    queryFn: () => fetchCityVenues(cityId!),
    enabled: Boolean(cityId) && (options.enabled ?? true),
    staleTime: 1000 * 60 * 5,
  });

export const useCityEvents = (cityId?: string, options: UseCityEventsOptions = {}) =>
  useQuery({
    queryKey: ["city-events", cityId, options.fallbackCulturalEvents ?? [], options.cityName ?? null],
    queryFn: () => fetchCityEvents(cityId!, options),
    enabled: Boolean(cityId) && (options.enabled ?? true),
    staleTime: 1000 * 60 * 5,
  });
