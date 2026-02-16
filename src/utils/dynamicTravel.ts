import { supabase } from "@/integrations/supabase/client";

export interface CityWithCoords {
  id: string;
  name: string;
  country: string;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  music_scene: number | null;
  population: number | null;
  is_coastal?: boolean;
  has_train_network?: boolean;
}

export interface TravelOption {
  mode: string;
  distanceKm: number;
  durationHours: number;
  cost: number;
  comfort: number;
  icon: string;
  available: boolean;
  unavailableReason?: string;
}

// Realistic transport mode configurations with region/country constraints
export const TRANSPORT_MODES = {
  bus: { 
    speedKmh: 56,           // ~10% faster (was 50)
    costPerKm: 0.05,        // Cheap option
    comfort: 25, 
    minDistance: 0, 
    maxDistance: 600,       // Bus only for shorter distances
    icon: 'bus',
    baseCost: 10,
    // Bus only within same country
    requiresSameCountry: true,
  },
  train: { 
    speedKmh: 200,          // ~10% faster (was 180)
    costPerKm: 0.12, 
    comfort: 75, 
    minDistance: 30, 
    maxDistance: 1500,      // Train for medium distances
    icon: 'train',
    baseCost: 25,
    // Train networks exist mainly in Europe and Asia
    trainNetworkRegions: ['Europe', 'Asia'],
  },
  plane: { 
    speedKmh: 944,          // ~10% faster (was 850)
    costPerKm: 0.12,
    comfort: 55, 
    minDistance: 200,       // Planes for longer distances
    maxDistance: 20000, 
    icon: 'plane', 
    baseCost: 150,          // Airport fees, taxes etc
    // Available everywhere
  },
  ship: { 
    speedKmh: 39,           // ~10% faster (was 35)
    costPerKm: 0.06, 
    comfort: 85,            // Leisurely travel
    minDistance: 50, 
    maxDistance: 2000,      // Ship for specific routes
    icon: 'ship',
    baseCost: 80,
    // Ship only for coastal cities
    requiresCoastal: true,
    // Valid ship routes between regions
    validShipRoutes: [
      ['Europe', 'Europe'],       // Within Europe (ferries)
      ['Europe', 'Africa'],       // Mediterranean
      ['Asia', 'Asia'],           // Asian coastlines
      ['Asia', 'Oceania'],        // Asia to Australia
      ['North America', 'North America'], // Coastal US
      ['Oceania', 'Oceania'],     // Australia/NZ
      ['Caribbean', 'North America'],    // Caribbean ferries
      ['Caribbean', 'South America'],    // Caribbean to SA
      ['Caribbean', 'Caribbean'],        // Inter-island
      ['Central America', 'North America'], // Central America coast
      ['Central America', 'South America'], // Pacific/Atlantic
      ['Central America', 'Central America'],
      ['Middle East', 'Africa'],         // Red Sea routes
      ['Middle East', 'Asia'],           // Persian Gulf
      ['Middle East', 'Middle East'],    // Gulf states
      ['South America', 'South America'], // SA coastline
      ['Africa', 'Africa'],             // African coast
    ],
  },
  private_jet: {
    speedKmh: 900,          // Faster than commercial (no layovers)
    costPerKm: 0,           // Fixed cost, not distance-based
    comfort: 100,           // Ultimate luxury
    minDistance: 0,         // Any distance
    maxDistance: 99999,     // Unlimited range
    icon: 'private_jet',
    baseCost: 75000,        // Fixed $75,000 cost
    // No restrictions - available everywhere
    fixedDuration: 2.7,     // 10% faster (was 3 hours)
    isImmediate: true,      // No departure schedules - leaves immediately
  },
} as const;

// Countries that share land borders/rail connections (for train routes)
const CONNECTED_COUNTRIES: Record<string, string[]> = {
  // Western Europe
  'United Kingdom': ['France', 'Belgium', 'Netherlands', 'Ireland'],
  'France': ['United Kingdom', 'Belgium', 'Germany', 'Spain', 'Italy', 'Switzerland', 'Netherlands', 'Luxembourg'],
  'Germany': ['France', 'Netherlands', 'Belgium', 'Austria', 'Switzerland', 'Poland', 'Czech Republic', 'Denmark', 'Luxembourg'],
  'Spain': ['France', 'Portugal'],
  'Italy': ['France', 'Switzerland', 'Austria', 'Germany', 'Slovenia'],
  'Netherlands': ['Germany', 'Belgium', 'France', 'United Kingdom'],
  'Belgium': ['France', 'Netherlands', 'Germany', 'United Kingdom', 'Luxembourg'],
  'Austria': ['Germany', 'Italy', 'Switzerland', 'Czech Republic', 'Hungary', 'Slovakia', 'Slovenia'],
  'Switzerland': ['France', 'Germany', 'Italy', 'Austria'],
  'Portugal': ['Spain'],
  'Ireland': ['United Kingdom'],
  'Luxembourg': ['France', 'Germany', 'Belgium'],
  // Scandinavia & Baltics
  'Sweden': ['Norway', 'Denmark', 'Finland'],
  'Norway': ['Sweden'],
  'Denmark': ['Germany', 'Sweden'],
  'Finland': ['Sweden', 'Estonia', 'Russia'],
  'Estonia': ['Latvia', 'Finland'],
  'Latvia': ['Estonia', 'Lithuania', 'Belarus'],
  'Lithuania': ['Latvia', 'Poland', 'Belarus'],
  // Central & Eastern Europe
  'Poland': ['Germany', 'Czech Republic', 'Slovakia', 'Lithuania', 'Ukraine', 'Belarus'],
  'Czech Republic': ['Germany', 'Austria', 'Poland', 'Slovakia'],
  'Slovakia': ['Czech Republic', 'Poland', 'Austria', 'Hungary'],
  'Hungary': ['Austria', 'Slovakia', 'Romania', 'Serbia', 'Croatia', 'Slovenia', 'Ukraine'],
  'Romania': ['Hungary', 'Bulgaria', 'Serbia', 'Moldova', 'Ukraine'],
  'Bulgaria': ['Romania', 'Serbia', 'Greece', 'North Macedonia'],
  'Serbia': ['Hungary', 'Romania', 'Bulgaria', 'Croatia', 'Bosnia and Herzegovina', 'North Macedonia'],
  'Croatia': ['Slovenia', 'Hungary', 'Serbia', 'Bosnia and Herzegovina'],
  'Slovenia': ['Italy', 'Austria', 'Hungary', 'Croatia'],
  'Greece': ['Bulgaria', 'Turkey', 'Albania', 'North Macedonia'],
  'Ukraine': ['Poland', 'Romania', 'Hungary', 'Moldova', 'Belarus'],
  'Belarus': ['Poland', 'Lithuania', 'Latvia', 'Russia', 'Ukraine'],
  'Moldova': ['Ukraine', 'Romania'],
  'Bosnia and Herzegovina': ['Croatia', 'Serbia'],
  'Albania': ['Greece', 'North Macedonia'],
  'North Macedonia': ['Serbia', 'Bulgaria', 'Greece', 'Albania'],
  // Caucasus
  'Georgia': ['Turkey', 'Armenia'],
  'Armenia': ['Georgia', 'Turkey'],
  // Russia & Central Asia
  'Russia': ['China', 'Finland', 'Belarus', 'Kazakhstan'],
  'Kazakhstan': ['Russia', 'China'],
  // Middle East
  'Turkey': ['Greece', 'Georgia', 'Armenia', 'Lebanon'],
  'Lebanon': ['Turkey', 'Jordan'],
  'Jordan': ['Saudi Arabia', 'Lebanon'],
  'Saudi Arabia': ['Jordan', 'United Arab Emirates'],
  'Qatar': ['Saudi Arabia'],
  'United Arab Emirates': ['Saudi Arabia'],
  // Asia
  'China': ['Russia', 'Mongolia', 'Vietnam', 'Pakistan', 'Kazakhstan'],
  'India': ['Pakistan', 'Bangladesh', 'Nepal'],
  'Pakistan': ['India', 'China'],
  'Bangladesh': ['India'],
  'Japan': [],
  'South Korea': [],
  'Thailand': ['Malaysia', 'Cambodia', 'Vietnam', 'Myanmar'],
  'Malaysia': ['Thailand', 'Singapore'],
  'Singapore': ['Malaysia'],
  'Vietnam': ['China', 'Cambodia', 'Thailand'],
  'Indonesia': [],
  'Philippines': [],
  'Sri Lanka': [],
  // Africa
  'Morocco': ['Spain', 'Algeria'],
  'Algeria': ['Tunisia', 'Morocco'],
  'Tunisia': ['Algeria'],
  'Egypt': [],
  'Nigeria': [],
  'South Africa': ['Mozambique'],
  'Kenya': ['Uganda', 'Tanzania'],
  'Uganda': ['Kenya', 'Tanzania'],
  'Tanzania': ['Kenya', 'Uganda', 'Mozambique'],
  'Mozambique': ['Tanzania', 'South Africa'],
  // Americas
  'United States': ['Canada', 'Mexico'],
  'Canada': ['United States'],
  'Mexico': ['United States', 'Guatemala'],
  'Guatemala': ['Honduras', 'Mexico'],
  'Honduras': ['Guatemala'],
  'Costa Rica': ['Panama'],
  'Panama': ['Costa Rica', 'Colombia'],
  'Colombia': ['Panama', 'Venezuela', 'Ecuador'],
  'Venezuela': ['Colombia', 'Brazil'],
  'Ecuador': ['Colombia', 'Peru'],
  'Peru': ['Ecuador', 'Bolivia'],
  'Brazil': ['Argentina', 'Paraguay', 'Uruguay', 'Venezuela', 'Bolivia'],
  'Argentina': ['Brazil', 'Chile', 'Uruguay', 'Paraguay', 'Bolivia'],
  'Bolivia': ['Peru', 'Brazil', 'Argentina', 'Paraguay'],
  'Paraguay': ['Brazil', 'Argentina', 'Bolivia'],
  // Oceania
  'Australia': [],
  'New Zealand': [],
  // Islands (no rail)
  'Dominican Republic': [],
  'Puerto Rico': [],
  'Haiti': [],
  'Senegal': [],
  'DR Congo': [],
  'Angola': [],
};

// Haversine formula to calculate distance between two coordinates
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Check if two countries are connected by rail
function areCountriesConnected(country1: string, country2: string): boolean {
  if (country1 === country2) return true;
  const connections = CONNECTED_COUNTRIES[country1] || [];
  return connections.includes(country2);
}

// Check if ship route is valid between regions
function isValidShipRoute(fromRegion: string | null, toRegion: string | null): boolean {
  if (!fromRegion || !toRegion) return false;
  
  const validRoutes = TRANSPORT_MODES.ship.validShipRoutes;
  return validRoutes.some(([r1, r2]) => 
    (r1 === fromRegion && r2 === toRegion) || 
    (r1 === toRegion && r2 === fromRegion)
  );
}

// Get available transport modes based on distance, regions, and city properties
export function getAvailableModes(
  distanceKm: number, 
  fromCity: CityWithCoords, 
  toCity: CityWithCoords
): TravelOption[] {
  const options: TravelOption[] = [];
  
  for (const [mode, config] of Object.entries(TRANSPORT_MODES)) {
    let available = true;
    let unavailableReason = '';
    
    // Check distance constraints
    if (distanceKm < config.minDistance) {
      available = false;
      unavailableReason = `Distance too short (min ${config.minDistance}km)`;
    } else if (distanceKm > config.maxDistance) {
      available = false;
      unavailableReason = `Distance too far (max ${config.maxDistance}km)`;
    }
    
    // Mode-specific constraints
    if (mode === 'bus') {
      // Bus requires same country
      if (fromCity.country !== toCity.country) {
        available = false;
        unavailableReason = 'Bus travel only within same country';
      }
    }
    
    if (mode === 'train') {
      // Check if countries are connected by rail
      const trainNetworkRegions = ['Europe', 'Asia'];
      const fromHasTrainNetwork = trainNetworkRegions.includes(fromCity.region || '');
      const toHasTrainNetwork = trainNetworkRegions.includes(toCity.region || '');
      
      if (!fromHasTrainNetwork || !toHasTrainNetwork) {
        // Check if same country (domestic rail usually exists)
        if (fromCity.country !== toCity.country) {
          available = false;
          unavailableReason = 'No train network in this region';
        }
      } else if (!areCountriesConnected(fromCity.country, toCity.country)) {
        available = false;
        unavailableReason = 'No direct rail connection between countries';
      }
    }
    
    if (mode === 'ship') {
      // Ship requires coastal cities and valid route
      const fromCoastal = fromCity.is_coastal ?? isDefaultCoastal(fromCity.name);
      const toCoastal = toCity.is_coastal ?? isDefaultCoastal(toCity.name);
      
      if (!fromCoastal || !toCoastal) {
        available = false;
        unavailableReason = 'Ship travel requires coastal cities';
      } else if (!isValidShipRoute(fromCity.region, toCity.region)) {
        available = false;
        unavailableReason = 'No ship routes between these regions';
      }
    }
    
    // Calculate cost and duration
    const modeKey = mode as keyof typeof TRANSPORT_MODES;
    const cost = available ? calculateModeCost(distanceKm, modeKey) : 0;
    const duration = available ? calculateDuration(distanceKm, modeKey) : 0;
    
    options.push({
      mode,
      distanceKm: Math.round(distanceKm),
      durationHours: duration,
      cost,
      comfort: config.comfort,
      icon: config.icon,
      available,
      unavailableReason: available ? undefined : unavailableReason,
    });
  }
  
  return options;
}

// Default coastal cities (used if is_coastal not set in DB)
function isDefaultCoastal(cityName: string): boolean {
  const coastalCities = [
    'London', 'Liverpool', 'Bristol', 'Glasgow', 'Edinburgh', 'Brighton',
    'Cardiff', 'Belfast', 'Newcastle', 'Portsmouth',
    'Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Gold Coast', 'Auckland', 'Wellington',
    'Tokyo', 'Osaka', 'Yokohama', 'Fukuoka', 'Nagoya',
    'Miami', 'San Francisco', 'Seattle', 'Los Angeles', 'San Diego', 'Boston', 'New York',
    'Houston', 'Honolulu',
    'Vancouver', 'Toronto',
    'Hong Kong', 'Singapore', 'Mumbai', 'Chennai', 'Kolkata', 'Colombo', 'Karachi',
    'Rio de Janeiro', 'São Paulo', 'Buenos Aires', 'Lima', 'Montevideo', 'Caracas',
    'Barcelona', 'Marseille', 'Naples', 'Venice', 'Lisbon', 'Porto', 'Malaga',
    'Nice', 'Bordeaux', 'Seville',
    'Athens', 'Istanbul', 'Dubai', 'Tel Aviv', 'Beirut', 'Doha',
    'Cape Town', 'Lagos', 'Cairo', 'Casablanca', 'Accra', 'Dakar', 'Dar es Salaam',
    'Luanda', 'Maputo', 'Tunis', 'Algiers',
    'Copenhagen', 'Stockholm', 'Oslo', 'Helsinki', 'Amsterdam', 'Rotterdam',
    'Hamburg', 'Gdansk', 'Gothenburg', 'Antwerp', 'Tallinn', 'Riga',
    'Shanghai', 'Shenzhen', 'Guangzhou', 'Busan', 'Taipei',
    'Bangkok', 'Ho Chi Minh City', 'Jakarta', 'Manila', 'Kuala Lumpur', 'Hanoi',
    'Panama City', 'San Juan', 'Santo Domingo', 'Port-au-Prince', 'Tirana',
  ];
  return coastalCities.includes(cityName);
}

// Calculate cost for a given distance and mode
export function calculateModeCost(distanceKm: number, mode: keyof typeof TRANSPORT_MODES): number {
  const config = TRANSPORT_MODES[mode];
  const baseCost = config.baseCost;
  
  // Private jet has fixed cost regardless of distance
  if (mode === 'private_jet') {
    return baseCost;
  }
  
  // Add distance-based cost
  let cost = baseCost + distanceKm * config.costPerKm;
  
  // Plane has tiered pricing
  if (mode === 'plane') {
    if (distanceKm > 5000) {
      // Long-haul flights are more expensive per km
      cost = baseCost + 5000 * config.costPerKm + (distanceKm - 5000) * config.costPerKm * 1.5;
    }
    if (distanceKm > 10000) {
      // Ultra long-haul
      cost += (distanceKm - 10000) * config.costPerKm * 0.5;
    }
  }
  
  return Math.round(cost);
}

// Calculate duration for a given distance and mode
export function calculateDuration(distanceKm: number, mode: keyof typeof TRANSPORT_MODES): number {
  const config = TRANSPORT_MODES[mode];
  
  // Private jet has fixed duration - skip all the waiting
  if (mode === 'private_jet' && 'fixedDuration' in config) {
    return config.fixedDuration;
  }
  
  // Add buffer time for boarding, etc.
  let bufferHours = 0;
  switch (mode) {
    case 'plane':
      bufferHours = 2.7; // 10% reduced (was 3)
      break;
    case 'train':
      bufferHours = 0.45; // 10% reduced (was 0.5)
      break;
    case 'ship':
      bufferHours = 0.9; // 10% reduced (was 1)
      break;
    case 'bus':
      bufferHours = 0.22; // 10% reduced (was 0.25)
      break;
  }
  
  const travelTime = distanceKm / config.speedKmh;
  return Math.round((travelTime + bufferHours) * 10) / 10;
}

// Fetch city with coordinates
export async function fetchCityWithCoords(cityId: string): Promise<CityWithCoords | null> {
  const { data, error } = await supabase
    .from("cities")
    .select("id, name, country, region, latitude, longitude, music_scene, population, is_coastal, has_train_network")
    .eq("id", cityId)
    .single();
  
  if (error || !data) return null;
  return data as CityWithCoords;
}

// Fetch all cities with coordinates
export async function fetchAllCitiesWithCoords(): Promise<CityWithCoords[]> {
  const { data, error } = await supabase
    .from("cities")
    .select("id, name, country, region, latitude, longitude, music_scene, population, is_coastal, has_train_network")
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("music_scene", { ascending: false });
  
  if (error || !data) return [];
  return data as CityWithCoords[];
}

// Calculate all travel options between two cities
export async function calculateTravelOptions(
  fromCityId: string,
  toCityId: string
): Promise<TravelOption[]> {
  const [fromCity, toCity] = await Promise.all([
    fetchCityWithCoords(fromCityId),
    fetchCityWithCoords(toCityId)
  ]);
  
  if (!fromCity || !toCity || !fromCity.latitude || !fromCity.longitude || !toCity.latitude || !toCity.longitude) {
    return [];
  }
  
  const distanceKm = calculateDistance(
    fromCity.latitude, fromCity.longitude,
    toCity.latitude, toCity.longitude
  );
  
  return getAvailableModes(distanceKm, fromCity, toCity)
    .sort((a, b) => {
      // Sort by available first, then by cost
      if (a.available && !b.available) return -1;
      if (!a.available && b.available) return 1;
      return a.cost - b.cost;
    });
}

// Get destinations from a city with calculated options
export async function getDestinationsFromCity(fromCityId: string): Promise<{
  city: CityWithCoords;
  distanceKm: number;
  options: TravelOption[];
  cheapestOption: TravelOption | null;
  fastestOption: TravelOption | null;
}[]> {
  const [fromCity, allCities] = await Promise.all([
    fetchCityWithCoords(fromCityId),
    fetchAllCitiesWithCoords()
  ]);
  
  if (!fromCity || !fromCity.latitude || !fromCity.longitude) return [];
  
  const destinations = allCities
    .filter(city => city.id !== fromCityId && city.latitude && city.longitude)
    .map(city => {
      const distanceKm = calculateDistance(
        fromCity.latitude!, fromCity.longitude!,
        city.latitude!, city.longitude!
      );
      
      const options = getAvailableModes(distanceKm, fromCity, city);
      const availableOptions = options.filter(o => o.available);
      
      const cheapestOption = availableOptions.length > 0 
        ? availableOptions.reduce((min, o) => o.cost < min.cost ? o : min)
        : null;
      
      const fastestOption = availableOptions.length > 0
        ? availableOptions.reduce((min, o) => o.durationHours < min.durationHours ? o : min)
        : null;
      
      return { 
        city, 
        distanceKm: Math.round(distanceKm), 
        options,
        cheapestOption,
        fastestOption,
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);
  
  return destinations;
}

// Get unique regions from cities
export async function getUniqueRegions(): Promise<string[]> {
  const { data, error } = await supabase
    .from("cities")
    .select("region")
    .not("region", "is", null);
  
  if (error || !data) return [];
  
  const regions = [...new Set(data.map(c => c.region).filter(Boolean))] as string[];
  return regions.sort();
}

// Get unique countries from cities
export async function getUniqueCountries(region?: string): Promise<string[]> {
  let query = supabase
    .from("cities")
    .select("country");
  
  if (region) {
    query = query.eq("region", region);
  }
  
  const { data, error } = await query;
  
  if (error || !data) return [];
  
  const countries = [...new Set(data.map(c => c.country))] as string[];
  return countries.sort();
}
