export type TravelMode = 'coach' | 'taxi' | 'air' | 'ferry';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface TravelModeConfig {
  label: string;
  description: string;
  speedKmh: number;
  costMultiplier: number;
  comfort: number; // 0-100 scale
}

export interface TravelEstimate {
  mode: TravelMode;
  speedKmh: number;
  timeHours: number;
  cost: number;
  comfort: number;
  description: string;
}

export const BASE_TRAVEL_SPEED_KMH = 80;
export const BASE_TRAVEL_COST_PER_KM = 0.75;
export const BASE_TRAVEL_FIXED_COST = 150;

export const TRAVEL_MODES: Record<TravelMode, TravelModeConfig> = {
  coach: {
    label: 'Coach',
    description: 'Budget-friendly coaches keep costs low at the expense of comfort and speed.',
    speedKmh: 70,
    costMultiplier: 0.85,
    comfort: 55,
  },
  taxi: {
    label: 'Taxi / Rideshare',
    description: 'Door-to-door ground travel with moderate speed and comfort.',
    speedKmh: 90,
    costMultiplier: 1.35,
    comfort: 65,
  },
  air: {
    label: 'Air',
    description: 'Fly between cities quickly with premium comfort and high costs.',
    speedKmh: 780,
    costMultiplier: 3.6,
    comfort: 85,
  },
  ferry: {
    label: 'Ferry',
    description: 'Slow scenic travel over water with the roughest ride.',
    speedKmh: 45,
    costMultiplier: 1.15,
    comfort: 45,
  },
};

export const TRAVEL_MODE_OPTIONS = (Object.entries(TRAVEL_MODES) as [TravelMode, TravelModeConfig][])?.map(
  ([value, config]) => ({
    value,
    label: config.label,
    description: config.description,
    comfort: config.comfort,
    speedKmh: config.speedKmh,
  })
);

export const getTravelModeConfig = (mode: TravelMode): TravelModeConfig =>
  TRAVEL_MODES[mode] ?? TRAVEL_MODES.coach;

export const calculateTravelEstimates = (distanceKm: number, mode: TravelMode): TravelEstimate => {
  const config = getTravelModeConfig(mode);
  const distance = Math.max(0, distanceKm || 0);
  const speedKmh = config.speedKmh || BASE_TRAVEL_SPEED_KMH;
  const rawHours = distance / speedKmh;
  const timeHours = Number.isFinite(rawHours) ? Number(rawHours.toFixed(2)) : 0;

  const baseCost = distance * BASE_TRAVEL_COST_PER_KM + BASE_TRAVEL_FIXED_COST;
  const cost = Math.max(0, Math.round(baseCost * config.costMultiplier));

  return {
    mode,
    speedKmh,
    timeHours,
    cost,
    comfort: config.comfort,
    description: config.description,
  };
};

export const describeComfort = (comfort: number) => {
  if (comfort >= 80) return 'High comfort';
  if (comfort >= 60) return 'Moderate comfort';
  if (comfort >= 45) return 'Rough ride';
  return 'Grueling travel';
};

export const LOW_COMFORT_THRESHOLD = 55;

const DEFAULT_COORDINATE: Coordinates = { lat: 39.5, lng: -98.35 };
const EARTH_RADIUS_KM = 6371;

const CITY_COORDINATES: Record<string, Coordinates> = {
  'nashville': { lat: 36.1627, lng: -86.7816 },
  'los angeles': { lat: 34.0522, lng: -118.2437 },
  'new york': { lat: 40.7128, lng: -74.006 },
  'new york city': { lat: 40.7128, lng: -74.006 },
  'nyc': { lat: 40.7128, lng: -74.006 },
  'london': { lat: 51.5072, lng: -0.1276 },
  'berlin': { lat: 52.52, lng: 13.405 },
  'portsmouth': { lat: 50.8198, lng: -1.0872 },
  'neo tokyo': { lat: 35.6895, lng: 139.6917 },
  'neo-tokyo': { lat: 35.6895, lng: 139.6917 },
  'solace city': { lat: 37.7749, lng: -122.4194 },
  'solace-city': { lat: 37.7749, lng: -122.4194 },
  'vela horizonte': { lat: -22.9068, lng: -43.1729 },
  'vela-horizonte': { lat: -22.9068, lng: -43.1729 },
  'asterhaven': { lat: 52.4862, lng: -1.8904 },
};

const DISTRICT_COORDINATES: Record<string, Coordinates> = {
  'downtown': { lat: 40.7128, lng: -74.006 },
  'downtown district': { lat: 40.7138, lng: -74.001 },
  'midtown': { lat: 40.7549, lng: -73.984 },
  'harbor': { lat: 47.6062, lng: -122.3321 },
  'harbour': { lat: 50.8198, lng: -1.0872 },
  'arts district': { lat: 34.043, lng: -118.235 },
  'arts quarter': { lat: 34.05, lng: -118.247 },
  'stadium district': { lat: 39.76, lng: -104.987 },
  'cultural center': { lat: 41.881, lng: -87.623 },
  'city park': { lat: 39.756, lng: -104.966 },
  'suburbs': { lat: 41, lng: -87.9 },
  'uptown': { lat: 41.894, lng: -87.634 },
  'sports district': { lat: 34.043, lng: -118.267 },
  'outskirts': { lat: 36.1699, lng: -115.1398 },
  'central': { lat: 39.0997, lng: -94.5786 },
};

const LOCATION_ALIASES: Record<string, string> = {
  'la': 'los angeles',
  'los angeles, ca': 'los angeles',
  'los angeles, california': 'los angeles',
  'new york, ny': 'new york',
  'new york, new york': 'new york',
  'new york city, ny': 'new york',
  'nashville, tn': 'nashville',
  'nashville, tennessee': 'nashville',
  'london, uk': 'london',
  'london, united kingdom': 'london',
  'berlin, germany': 'berlin',
  'portsmouth, uk': 'portsmouth',
  'portsmouth, united kingdom': 'portsmouth',
  'shibuya': 'neo tokyo',
  'shibuya, japan': 'neo tokyo',
  'neo tokyo, japan': 'neo tokyo',
  'solace city, united states': 'solace city',
  'solace city, usa': 'solace city',
  'vela horizonte, brazil': 'vela horizonte',
  'asterhaven, united kingdom': 'asterhaven',
  'asterhaven, uk': 'asterhaven',
};

const stripDiacritics = (value: string) =>
  value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

const normalizeKey = (value: string) =>
  stripDiacritics(value)
    .replace(/[^a-z0-9\s,-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const KNOWN_COORDINATES: Record<string, Coordinates> = {
  ...CITY_COORDINATES,
  ...DISTRICT_COORDINATES,
};

const resolveCoordinateKey = (value: string): string | null => {
  const normalized = normalizeKey(value);
  if (!normalized) {
    return null;
  }

  if (KNOWN_COORDINATES[normalized]) {
    return normalized;
  }

  const aliasTarget = LOCATION_ALIASES[normalized];
  if (aliasTarget && KNOWN_COORDINATES[aliasTarget]) {
    return aliasTarget;
  }

  if (normalized.includes(',')) {
    const [primary] = normalized.split(',');
    if (primary && KNOWN_COORDINATES[primary]) {
      return primary;
    }
    const primaryAlias = LOCATION_ALIASES[primary];
    if (primaryAlias && KNOWN_COORDINATES[primaryAlias]) {
      return primaryAlias;
    }
  }

  for (const key of Object.keys(KNOWN_COORDINATES)) {
    if (normalized.includes(key)) {
      return key;
    }
  }

  for (const [alias, target] of Object.entries(LOCATION_ALIASES)) {
    if (normalized.includes(alias) && KNOWN_COORDINATES[target]) {
      return target;
    }
  }

  return null;
};

const hashToCoordinate = (value: string): Coordinates => {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  const lat = ((hash % 180000) / 1000) - 90;
  const lng = (((Math.floor(hash / 180000)) % 360000) / 1000) - 180;

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }

  return DEFAULT_COORDINATE;
};

export const getCoordinatesForLocation = (
  location?: string | null,
  options: { country?: string | null; fallback?: Coordinates | null } = {},
): Coordinates => {
  const fallback = options.fallback ?? DEFAULT_COORDINATE;
  if (!location) {
    return fallback;
  }

  const key = resolveCoordinateKey(location);
  if (key) {
    return KNOWN_COORDINATES[key];
  }

  if (options.country) {
    const combinedKey = resolveCoordinateKey(`${location}, ${options.country}`);
    if (combinedKey) {
      return KNOWN_COORDINATES[combinedKey];
    }

    const countryKey = resolveCoordinateKey(options.country);
    if (countryKey) {
      return KNOWN_COORDINATES[countryKey];
    }
  }

  return hashToCoordinate(`${location}`);
};

export const getCoordinatesForCity = (
  cityName?: string | null,
  country?: string | null,
): Coordinates => getCoordinatesForLocation(cityName, { country });

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export const calculateDistanceBetweenCoordinates = (from: Coordinates, to: Coordinates): number => {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));

  return Math.round(EARTH_RADIUS_KM * c * 100) / 100;
};

export const calculateDistanceBetweenLocations = (
  fromLocation?: string | null,
  toLocation?: string | null,
  options: { fromCountry?: string | null; toCountry?: string | null } = {},
): number => {
  const from = getCoordinatesForLocation(fromLocation, { country: options.fromCountry });
  const to = getCoordinatesForLocation(toLocation, { country: options.toCountry });
  return calculateDistanceBetweenCoordinates(from, to);
};

