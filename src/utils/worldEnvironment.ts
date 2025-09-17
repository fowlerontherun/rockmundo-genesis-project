import { supabase } from "@/integrations/supabase/client";

const WEATHER_CONDITIONS = ["sunny", "cloudy", "rainy", "stormy", "snowy"] as const;
const WORLD_EVENT_TYPES = ["festival", "competition", "disaster", "celebration", "economic"] as const;
const RANDOM_EVENT_RARITIES = ["common", "rare", "epic", "legendary"] as const;

const ATTENDANCE_EFFECT_KEYS = new Set([
  "attendance",
  "gig_attendance",
  "audience",
  "crowd",
]);

const COST_EFFECT_KEYS = new Set([
  "travel_cost",
  "logistics_cost",
  "cost_multiplier",
  "expenses",
]);

const MORALE_EFFECT_KEYS = new Set([
  "mood_modifier",
  "morale",
  "band_morale",
  "energy",
]);

const parseNumericRecord = (record: Record<string, unknown> | null | undefined) => {
  if (!record || typeof record !== "object") {
    return {} as Record<string, number>;
  }

  return Object.entries(record).reduce<Record<string, number>>((acc, [key, value]) => {
    if (typeof value === "number") {
      acc[key] = value;
      return acc;
    }

    const numericValue = Number(value);
    if (!Number.isNaN(numericValue)) {
      acc[key] = numericValue;
    }
    return acc;
  }, {});
};

const toNumber = (value: unknown, defaultValue = 0) => {
  if (typeof value === "number") {
    return value;
  }

  const numericValue = Number(value);
  return Number.isNaN(numericValue) ? defaultValue : numericValue;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeStringArray = (value: unknown): string[] => {
  if (typeof value === "string") {
    return value.trim() ? [value.trim()] : [];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item): item is string => Boolean(item));
};

const formatTravelModeLabel = (mode: string) =>
  mode
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

export interface CityLocation {
  name: string;
  description: string;
  highlights: string[];
  signatureVenue?: string;
  vibe?: string;
  averageTicketPrice?: number;
  tags?: string[];
}

export interface TravelOption {
  mode: string;
  label: string;
  name: string;
  description: string;
  frequency?: string;
  averageCost?: number;
  durationMinutes?: number;
  connectsTo: string[];
  coverage?: string[];
  capacity?: string;
  comfort?: string;
  icon?: string;
}

const normalizeDistricts = (value: unknown): CityLocation[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<CityLocation[]>((acc, entry) => {
    if (!isRecord(entry)) {
      return acc;
    }

    const nameRaw = typeof entry.name === "string" ? entry.name.trim() : "";
    const descriptionRaw = typeof entry.description === "string" ? entry.description.trim() : "";
    const signatureVenue = typeof entry.signature_venue === "string" ? entry.signature_venue.trim() : undefined;
    const vibe = typeof entry.vibe === "string" ? entry.vibe.trim() : undefined;
    const tags = normalizeStringArray(entry.tags);
    const highlights = normalizeStringArray(entry.highlights);
    const additionalHighlights = normalizeStringArray(entry.additional_highlights);
    const combinedHighlights = Array.from(new Set([...highlights, ...additionalHighlights]));
    if (!combinedHighlights.length && signatureVenue) {
      combinedHighlights.push(signatureVenue);
    }

    const averageTicketPriceRaw = entry.average_ticket_price ?? entry.avg_ticket_price;
    const averageTicketPrice = toNumber(averageTicketPriceRaw, Number.NaN);

    const location: CityLocation = {
      name: nameRaw || "Featured District",
      description: descriptionRaw || "A notable part of the city experience.",
      highlights: combinedHighlights,
    };

    if (signatureVenue) {
      location.signatureVenue = signatureVenue;
    }

    if (vibe) {
      location.vibe = vibe;
    }

    if (tags.length) {
      location.tags = tags;
    }

    if (!Number.isNaN(averageTicketPrice)) {
      location.averageTicketPrice = averageTicketPrice;
    }

    acc.push(location);
    return acc;
  }, []);
};

const normalizeTravelNodes = (value: unknown): TravelOption[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<TravelOption[]>((acc, entry) => {
    if (!isRecord(entry)) {
      return acc;
    }

    const modeRaw = typeof entry.mode === "string" ? entry.mode.trim() : "";
    const nameRaw = typeof entry.name === "string" ? entry.name.trim() : "";
    const descriptionRaw = typeof entry.description === "string" ? entry.description.trim() : "";
    const frequency = typeof entry.frequency === "string" ? entry.frequency.trim() : undefined;
    const averageCostRaw = entry.average_cost ?? entry.cost;
    const durationRaw = entry.duration_minutes ?? entry.duration;
    const averageCost = toNumber(averageCostRaw, Number.NaN);
    const durationMinutes = toNumber(durationRaw, Number.NaN);
    const connectsTo = normalizeStringArray(entry.connects_to ?? entry.links ?? entry.serves);
    const coverage = normalizeStringArray(entry.coverage);
    const capacity = typeof entry.capacity === "string" ? entry.capacity.trim() : undefined;
    const comfort = typeof entry.comfort === "string" ? entry.comfort.trim() : undefined;
    const icon = typeof entry.icon === "string" ? entry.icon.trim() : undefined;

    const mode = modeRaw || "custom";
    const travelOption: TravelOption = {
      mode,
      label: formatTravelModeLabel(mode),
      name: nameRaw || formatTravelModeLabel(mode),
      description: descriptionRaw || formatTravelModeLabel(mode),
      connectsTo,
    };

    if (frequency) {
      travelOption.frequency = frequency;
    }

    if (!Number.isNaN(averageCost)) {
      travelOption.averageCost = averageCost;
    }

    if (!Number.isNaN(durationMinutes)) {
      travelOption.durationMinutes = durationMinutes;
    }

    if (coverage.length) {
      travelOption.coverage = coverage;
    }

    if (capacity) {
      travelOption.capacity = capacity;
    }

    if (comfort) {
      travelOption.comfort = comfort;
    }

    if (icon) {
      travelOption.icon = icon;
    }

    acc.push(travelOption);
    return acc;
  }, []);
};

export interface WeatherCondition {
  id: string;
  city: string;
  country: string;
  temperature: number;
  condition: (typeof WEATHER_CONDITIONS)[number];
  humidity: number;
  wind_speed: number;
  effects: {
    gig_attendance: number;
    travel_cost: number;
    mood_modifier: number;
    equipment_risk: number;
  };
}

export interface City {
  id: string;
  name: string;
  country: string;
  description?: string;
  bonuses?: string;
  unlocked?: boolean;
  population: number;
  music_scene: number;
  cost_of_living: number;
  dominant_genre: string;
  venues: number;
  local_bonus: number;
  cultural_events: string[];
  locations: CityLocation[];
  famousResident: string;
  travelHub: string;
  travelOptions: TravelOption[];
}

export interface WorldEvent {
  id: string;
  title: string;
  description: string;
  type: (typeof WORLD_EVENT_TYPES)[number];
  start_date: string;
  end_date: string;
  affected_cities: string[];
  global_effects: Record<string, number>;
  participation_reward: number;
  is_active: boolean;
}

export interface RandomEventChoice {
  id: string;
  text: string;
  effects: Record<string, number>;
  requirements?: Record<string, number>;
}

export interface RandomEvent {
  id: string;
  title: string;
  description: string;
  choices: RandomEventChoice[];
  expiry: string;
  rarity: (typeof RANDOM_EVENT_RARITIES)[number];
}

export interface AppliedEnvironmentEffect {
  source: "weather" | "world_event";
  id: string;
  name: string;
  description?: string;
  attendanceMultiplier?: number;
  costMultiplier?: number;
  moraleModifier?: number;
}

export interface EnvironmentProjections {
  attendance?: number;
  travelCost?: number;
  lodgingCost?: number;
  miscCost?: number;
}

export interface EnvironmentModifierSummary {
  attendanceMultiplier: number;
  costMultiplier: number;
  moraleModifier: number;
  retrievedAt: string;
  applied: AppliedEnvironmentEffect[];
  projections?: EnvironmentProjections;
}

export interface WorldEnvironmentSnapshot {
  weather: WeatherCondition[];
  cities: City[];
  worldEvents: WorldEvent[];
  randomEvents: RandomEvent[];
}

const normalizeWeatherRecord = (item: Record<string, unknown>): WeatherCondition => {
  const conditionRaw = typeof item.condition === "string" ? item.condition : "";
  const condition = WEATHER_CONDITIONS.includes(conditionRaw as WeatherCondition["condition"]) ?
    (conditionRaw as WeatherCondition["condition"]) : "sunny";

  const effectsData = parseNumericRecord(item.effects as Record<string, unknown> | null | undefined);
  const temperatureValue = toNumber(item.temperature);
  const humidityValue = toNumber(item.humidity);
  const windSpeedValue = toNumber(item.wind_speed);

  return {
    id: String(item.id ?? crypto.randomUUID()),
    city: typeof item.city === "string" ? item.city : "Unknown",
    country: typeof item.country === "string" ? item.country : "",
    temperature: Number.isNaN(temperatureValue) ? 0 : temperatureValue,
    condition,
    humidity: Number.isNaN(humidityValue) ? 0 : humidityValue,
    wind_speed: Number.isNaN(windSpeedValue) ? 0 : windSpeedValue,
    effects: {
      gig_attendance: effectsData.gig_attendance ?? 1,
      travel_cost: effectsData.travel_cost ?? 1,
      mood_modifier: effectsData.mood_modifier ?? 1,
      equipment_risk: effectsData.equipment_risk ?? 1,
    },
  };
};

const normalizeCityRecord = (item: Record<string, unknown>): City => {
  const culturalEvents = normalizeStringArray(item.cultural_events);
  const locations = normalizeDistricts(item.districts);
  const travelOptions = normalizeTravelNodes(item.travel_nodes);
  const famousResidentRaw = typeof item.famous_resident === "string" ? item.famous_resident.trim() : "";
  const travelHubRaw = typeof item.travel_hub === "string" ? item.travel_hub.trim() : "";
  const description = typeof item.description === "string" ? item.description : undefined;
  const bonuses = typeof item.bonuses === "string" ? item.bonuses : undefined;
  const unlocked = typeof item.unlocked === "boolean" ? item.unlocked : undefined;

  return {
    id: String(item.id ?? crypto.randomUUID()),
    name: typeof item.name === "string" ? item.name : "Unknown",
    country: typeof item.country === "string" ? item.country : "",
    description,
    bonuses,
    unlocked,
    population: toNumber(item.population),
    music_scene: toNumber(item.music_scene),
    cost_of_living: toNumber(item.cost_of_living),
    dominant_genre: typeof item.dominant_genre === "string" ? item.dominant_genre : "",
    venues: toNumber(item.venues),
    local_bonus: toNumber(item.local_bonus, 1),
    cultural_events: culturalEvents,
    locations,
    famousResident: famousResidentRaw || "Local legend emerging",
    travelHub: travelHubRaw || travelOptions[0]?.name || "",
    travelOptions,
  };
};

const normalizeWorldEventRecord = (item: Record<string, unknown>): WorldEvent => {
  const typeRaw = typeof item.type === "string" ? item.type : "";
  const type = WORLD_EVENT_TYPES.includes(typeRaw as WorldEvent["type"]) ?
    (typeRaw as WorldEvent["type"]) : "festival";

  const globalEffects = parseNumericRecord(item.global_effects as Record<string, unknown> | null | undefined);
  const affectedCities = Array.isArray(item.affected_cities)
    ? item.affected_cities.filter((city: unknown): city is string => typeof city === "string")
    : [];

  const startDate = typeof item.start_date === "string" ? item.start_date : new Date().toISOString();
  const endDate = typeof item.end_date === "string" ? item.end_date : startDate;

  return {
    id: String(item.id ?? crypto.randomUUID()),
    title: typeof item.title === "string" ? item.title : "Global Event",
    description: typeof item.description === "string" ? item.description : "",
    type,
    start_date: startDate,
    end_date: endDate,
    affected_cities: affectedCities,
    global_effects: globalEffects,
    participation_reward: toNumber(item.participation_reward),
    is_active: Boolean(item.is_active),
  };
};

const normalizeRandomEventRecord = (item: Record<string, unknown>, index: number): RandomEvent | null => {
  const rarityRaw = typeof item.rarity === "string" ? item.rarity : "";
  const rarity = RANDOM_EVENT_RARITIES.includes(rarityRaw as RandomEvent["rarity"]) ?
    (rarityRaw as RandomEvent["rarity"]) : "common";

  const expiry = typeof item.expiry === "string"
    ? item.expiry
    : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const choicesRaw = Array.isArray(item.choices) ? item.choices : [];
  const choices = choicesRaw
    .map((choice: Record<string, unknown>, choiceIndex: number) => {
      const effects = parseNumericRecord(choice.effects as Record<string, unknown> | null | undefined);
      const requirements = parseNumericRecord(choice.requirements as Record<string, unknown> | null | undefined);
      const text = typeof choice.text === "string" ? choice.text : "";

      if (!text.trim()) {
        return null;
      }

      const choiceId = choice.id ?? `${item.id}-choice-${choiceIndex}`;

      return {
        id: String(choiceId),
        text,
        effects,
        requirements: Object.keys(requirements).length > 0 ? requirements : undefined,
      };
    })
    .filter((choice): choice is RandomEventChoice => Boolean(choice));

  const title = typeof item.title === "string" ? item.title : "Random Event";
  const description = typeof item.description === "string" ? item.description : "";

  return {
    id: String(item.id ?? `random-${index}`),
    title,
    description,
    choices,
    expiry,
    rarity,
  };
};

const locationMatches = (needle: string, haystack: string) => {
  if (!needle || !haystack) {
    return false;
  }

  const normalizedNeedle = needle.trim().toLowerCase();
  const normalizedHaystack = haystack.trim().toLowerCase();

  if (!normalizedNeedle || !normalizedHaystack) {
    return false;
  }

  if (normalizedNeedle === normalizedHaystack) {
    return true;
  }

  return normalizedHaystack.includes(normalizedNeedle) || normalizedNeedle.includes(normalizedHaystack);
};

export const fetchWorldEnvironmentSnapshot = async (): Promise<WorldEnvironmentSnapshot> => {
  const [weatherResponse, citiesResponse, worldEventsResponse, randomEventsResponse] = await Promise.all([
    supabase.from("weather").select("*").order("city", { ascending: true }),
    supabase.from("cities").select("*").order("name", { ascending: true }),
    supabase.from("world_events").select("*").order("start_date", { ascending: true }),
    supabase.from("random_events").select("*").order("expiry", { ascending: true }),
  ]);

  if (weatherResponse.error) throw weatherResponse.error;
  if (citiesResponse.error) throw citiesResponse.error;
  if (worldEventsResponse.error) throw worldEventsResponse.error;
  if (randomEventsResponse.error) throw randomEventsResponse.error;

  const weather = (weatherResponse.data || []).map((item) => normalizeWeatherRecord(item as Record<string, unknown>));
  const cities = (citiesResponse.data || []).map((item) => normalizeCityRecord(item as Record<string, unknown>));

  const worldEvents = (worldEventsResponse.data || [])
    .map((item) => normalizeWorldEventRecord(item as Record<string, unknown>))
    .sort((a, b) => {
      const startA = Date.parse(a.start_date);
      const startB = Date.parse(b.start_date);

      if (Number.isNaN(startA) || Number.isNaN(startB)) {
        return 0;
      }

      return startA - startB;
    });

  const now = Date.now();
  const randomEvents = (randomEventsResponse.data || [])
    .map((item, index) => normalizeRandomEventRecord(item as Record<string, unknown>, index))
    .filter((event): event is RandomEvent => {
      if (!event) {
        return false;
      }

      const expiryTime = Date.parse(event.expiry);
      if (Number.isNaN(expiryTime)) {
        return true;
      }

      return expiryTime > now;
    })
    .sort((a, b) => {
      const expiryA = Date.parse(a.expiry);
      const expiryB = Date.parse(b.expiry);

      if (Number.isNaN(expiryA) || Number.isNaN(expiryB)) {
        return 0;
      }

      return expiryA - expiryB;
    });

  return {
    weather,
    cities,
    worldEvents,
    randomEvents,
  };
};

export const fetchEnvironmentModifiers = async (
  location: string,
  isoDate: string,
): Promise<EnvironmentModifierSummary> => {
  const [weatherResponse, worldEventsResponse] = await Promise.all([
    supabase.from("weather").select("*"),
    supabase.from("world_events").select("*"),
  ]);

  if (weatherResponse.error) throw weatherResponse.error;
  if (worldEventsResponse.error) throw worldEventsResponse.error;

  const weather = (weatherResponse.data || []).map((item) => normalizeWeatherRecord(item as Record<string, unknown>));
  const worldEvents = (worldEventsResponse.data || []).map((item) => normalizeWorldEventRecord(item as Record<string, unknown>));

  const targetDate = new Date(isoDate);
  const targetTime = targetDate.getTime();

  const applied: AppliedEnvironmentEffect[] = [];
  let attendanceMultiplier = 1;
  let costMultiplier = 1;
  let moraleModifier = 1;

  const matchingWeather = weather.find((condition) =>
    locationMatches(condition.city, location) ||
    locationMatches(location, condition.city) ||
    locationMatches(condition.country, location)
  );

  if (matchingWeather) {
    attendanceMultiplier *= matchingWeather.effects.gig_attendance ?? 1;
    costMultiplier *= matchingWeather.effects.travel_cost ?? 1;
    moraleModifier *= matchingWeather.effects.mood_modifier ?? 1;

    applied.push({
      source: "weather",
      id: matchingWeather.id,
      name: `${matchingWeather.city} Weather`,
      description: `${matchingWeather.condition} • ${matchingWeather.temperature}°C`,
      attendanceMultiplier: matchingWeather.effects.gig_attendance,
      costMultiplier: matchingWeather.effects.travel_cost,
      moraleModifier: matchingWeather.effects.mood_modifier,
    });
  }

  const relevantEvents = worldEvents.filter((event) => {
    const startTime = Date.parse(event.start_date);
    const endTime = Date.parse(event.end_date);

    const activeByDate = !Number.isNaN(startTime) && !Number.isNaN(endTime)
      ? targetTime >= startTime && targetTime <= endTime
      : false;

    const affectsLocation = event.affected_cities.includes("all") ||
      event.affected_cities.some((city) => locationMatches(city, location) || locationMatches(location, city));

    return affectsLocation && (event.is_active || activeByDate);
  });

  relevantEvents.forEach((event) => {
    let eventAttendanceMultiplier = 1;
    let eventCostMultiplier = 1;
    let eventMoraleModifier = 1;

    Object.entries(event.global_effects).forEach(([key, value]) => {
      if (typeof value !== "number") {
        return;
      }

      const normalizedKey = key.toLowerCase();

      if (ATTENDANCE_EFFECT_KEYS.has(normalizedKey)) {
        eventAttendanceMultiplier *= value;
      }

      if (COST_EFFECT_KEYS.has(normalizedKey)) {
        eventCostMultiplier *= value;
      }

      if (MORALE_EFFECT_KEYS.has(normalizedKey)) {
        eventMoraleModifier *= value;
      }
    });

    attendanceMultiplier *= eventAttendanceMultiplier;
    costMultiplier *= eventCostMultiplier;
    moraleModifier *= eventMoraleModifier;

    if (eventAttendanceMultiplier !== 1 || eventCostMultiplier !== 1 || eventMoraleModifier !== 1) {
      applied.push({
        source: "world_event",
        id: event.id,
        name: event.title,
        description: event.description,
        attendanceMultiplier: eventAttendanceMultiplier !== 1 ? eventAttendanceMultiplier : undefined,
        costMultiplier: eventCostMultiplier !== 1 ? eventCostMultiplier : undefined,
        moraleModifier: eventMoraleModifier !== 1 ? eventMoraleModifier : undefined,
      });
    }
  });

  return {
    attendanceMultiplier,
    costMultiplier,
    moraleModifier,
    retrievedAt: new Date().toISOString(),
    applied,
  };
};

export type {
  WeatherCondition as WeatherConditionType,
  City as CityType,
  WorldEvent as WorldEventType,
  RandomEvent as RandomEventType,
};
