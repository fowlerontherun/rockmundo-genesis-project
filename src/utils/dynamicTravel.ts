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
}

export interface TravelOption {
  mode: string;
  distanceKm: number;
  durationHours: number;
  cost: number;
  comfort: number;
  icon: string;
}

// Transport mode configurations
export const TRANSPORT_MODES = {
  bus: { speedKmh: 60, costPerKm: 0.08, comfort: 40, minDistance: 0, maxDistance: 800, icon: 'bus' },
  train: { speedKmh: 120, costPerKm: 0.15, comfort: 70, minDistance: 50, maxDistance: 2000, icon: 'train' },
  plane: { speedKmh: 800, costPerKm: 0.12, comfort: 60, minDistance: 300, maxDistance: 20000, icon: 'plane', baseCost: 150 },
  ship: { speedKmh: 40, costPerKm: 0.10, comfort: 75, minDistance: 100, maxDistance: 5000, icon: 'ship' },
} as const;

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

// Get available transport modes based on distance and regions
export function getAvailableModes(distanceKm: number, fromRegion: string | null, toRegion: string | null): string[] {
  const modes: string[] = [];
  
  for (const [mode, config] of Object.entries(TRANSPORT_MODES)) {
    if (distanceKm >= config.minDistance && distanceKm <= config.maxDistance) {
      // Ship only for certain region combinations (coastal routes)
      if (mode === 'ship') {
        const coastalRegions = ['Europe', 'Oceania', 'Asia'];
        if (coastalRegions.includes(fromRegion || '') && coastalRegions.includes(toRegion || '')) {
          modes.push(mode);
        }
      } else {
        modes.push(mode);
      }
    }
  }
  
  // Cross-region long distances should prefer plane
  if (fromRegion !== toRegion && distanceKm > 500 && !modes.includes('plane')) {
    modes.push('plane');
  }
  
  return modes;
}

// Calculate cost for a given distance and mode
export function calculateModeCost(distanceKm: number, mode: keyof typeof TRANSPORT_MODES): number {
  const config = TRANSPORT_MODES[mode];
  const baseCost = 'baseCost' in config ? config.baseCost : 0;
  return Math.round(baseCost + distanceKm * config.costPerKm);
}

// Calculate duration for a given distance and mode
export function calculateDuration(distanceKm: number, mode: keyof typeof TRANSPORT_MODES): number {
  const config = TRANSPORT_MODES[mode];
  // Add buffer time for boarding, etc.
  const bufferHours = mode === 'plane' ? 2 : mode === 'train' ? 0.5 : 0.25;
  return Math.round((distanceKm / config.speedKmh + bufferHours) * 10) / 10;
}

// Fetch city with coordinates
export async function fetchCityWithCoords(cityId: string): Promise<CityWithCoords | null> {
  const { data, error } = await supabase
    .from("cities")
    .select("id, name, country, region, latitude, longitude, music_scene, population")
    .eq("id", cityId)
    .single();
  
  if (error || !data) return null;
  return data as CityWithCoords;
}

// Fetch all cities with coordinates
export async function fetchAllCitiesWithCoords(): Promise<CityWithCoords[]> {
  const { data, error } = await supabase
    .from("cities")
    .select("id, name, country, region, latitude, longitude, music_scene, population")
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
  
  const availableModes = getAvailableModes(distanceKm, fromCity.region, toCity.region);
  
  return availableModes.map(mode => {
    const modeKey = mode as keyof typeof TRANSPORT_MODES;
    return {
      mode,
      distanceKm: Math.round(distanceKm),
      durationHours: calculateDuration(distanceKm, modeKey),
      cost: calculateModeCost(distanceKm, modeKey),
      comfort: TRANSPORT_MODES[modeKey].comfort,
      icon: TRANSPORT_MODES[modeKey].icon,
    };
  }).sort((a, b) => a.cost - b.cost);
}

// Get destinations from a city with calculated options
export async function getDestinationsFromCity(fromCityId: string): Promise<{
  city: CityWithCoords;
  distanceKm: number;
  options: TravelOption[];
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
      
      const availableModes = getAvailableModes(distanceKm, fromCity.region, city.region);
      const options = availableModes.map(mode => {
        const modeKey = mode as keyof typeof TRANSPORT_MODES;
        return {
          mode,
          distanceKm: Math.round(distanceKm),
          durationHours: calculateDuration(distanceKm, modeKey),
          cost: calculateModeCost(distanceKm, modeKey),
          comfort: TRANSPORT_MODES[modeKey].comfort,
          icon: TRANSPORT_MODES[modeKey].icon,
        };
      }).sort((a, b) => a.cost - b.cost);
      
      return { city, distanceKm: Math.round(distanceKm), options };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);
  
  return destinations;
}
