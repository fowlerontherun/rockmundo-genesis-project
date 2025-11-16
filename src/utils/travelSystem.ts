import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface TravelRoute {
  id: string;
  from_city_id: string;
  to_city_id: string;
  transport_type: string;
  base_cost: number;
  duration_hours: number;
  comfort_rating: number;
  from_city?: { name: string; country: string };
  to_city?: { name: string; country: string };
}

export interface TravelBookingData {
  userId: string;
  fromCityId: string;
  toCityId: string;
  routeId: string;
  transportType: string;
  cost: number;
  durationHours: number;
  comfortRating: number;
  scheduledDepartureTime?: string;
}

export async function validateTravelEligibility(userId: string, cost: number) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("cash")
    .eq("user_id", userId)
    .single();

  if (profileError) {
    throw new Error("Failed to fetch profile");
  }

  if (!profile || (profile.cash || 0) < cost) {
    throw new Error("Insufficient funds for this travel");
  }

  return true;
}

export async function bookTravel(bookingData: TravelBookingData) {
  const { userId, fromCityId, toCityId, transportType, cost, durationHours, comfortRating, scheduledDepartureTime } = bookingData;

  // Validate eligibility
  await validateTravelEligibility(userId, cost);

  // Start transaction-like operations
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, cash, display_name")
    .eq("user_id", userId)
    .single();

  if (profileError) throw profileError;

  // Deduct cost only - do NOT update current_city_id yet
  // Player will move to new city only after travel completes
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ 
      cash: (profile.cash || 0) - cost
    })
    .eq("user_id", userId);

  if (updateError) throw updateError;

  // Get city names for history
  const { data: fromCity } = await supabase
    .from("cities")
    .select("name, country")
    .eq("id", fromCityId)
    .single();

  const { data: toCity } = await supabase
    .from("cities")
    .select("name, country")
    .eq("id", toCityId)
    .single();

  // Create travel history entry
  const departureTime = scheduledDepartureTime || new Date().toISOString();
  const departureDate = new Date(departureTime);
  const arrivalTime = new Date(departureDate.getTime() + durationHours * 60 * 60 * 1000).toISOString();
  
  // Determine status: if departure is in the future, it's scheduled; if now, it's in progress
  const now = new Date();
  const status = departureDate > now ? 'scheduled' : 'in_progress';
  
  const { error: historyError } = await supabase
    .from("player_travel_history")
    .insert({
      user_id: userId,
      from_city_id: fromCityId,
      to_city_id: toCityId,
      transport_type: transportType,
      cost_paid: cost,
      travel_duration_hours: durationHours,
      departure_time: departureTime,
      scheduled_departure_time: departureTime,
      arrival_time: arrivalTime,
      status,
    });

  if (historyError) throw historyError;

  // Log activity
  const fromCityName = fromCity ? `${fromCity.name}, ${fromCity.country}` : "Unknown";
  const toCityName = toCity ? `${toCity.name}, ${toCity.country}` : "Unknown";
  
  await supabase.from("activity_feed").insert({
    user_id: userId,
    activity_type: "travel",
    message: `Traveled from ${fromCityName} to ${toCityName} by ${transportType}`,
    metadata: {
      from_city_id: fromCityId,
      to_city_id: toCityId,
      transport_type: transportType,
      cost: cost,
      duration_hours: durationHours,
    },
  });

  // Award XP for travel (5 XP per travel)
  await supabase.from("experience_ledger").insert({
    user_id: userId,
    activity_type: "travel",
    xp_amount: 5,
    metadata: {
      from_city: fromCityName,
      to_city: toCityName,
    },
  });

  return {
    success: true,
    message: `Successfully traveled to ${toCityName}`,
    newLocation: toCityName,
  };
}

export function calculateTravelCost(baseCost: number, comfortRating: number): number {
  // Higher comfort = higher cost (slight multiplier)
  const comfortMultiplier = 1 + (comfortRating - 50) / 200;
  return Math.round(baseCost * comfortMultiplier);
}

export async function getAvailableRoutes(fromCityId: string) {
  const { data, error } = await supabase
    .from("city_transport_routes")
    .select(`
      *,
      from_city:cities!city_transport_routes_from_city_id_fkey(name, country),
      to_city:cities!city_transport_routes_to_city_id_fkey(name, country)
    `)
    .eq("from_city_id", fromCityId);

  if (error) {
    console.error("Error fetching routes:", error);
    return [];
  }

  return data || [];
}
