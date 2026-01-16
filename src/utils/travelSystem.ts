import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { checkTimeSlotAvailable } from "@/hooks/useActivityBooking";
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
    .maybeSingle();

  if (profileError) {
    console.error('Travel eligibility check failed:', profileError);
    throw new Error(`Failed to fetch profile: ${profileError.message}`);
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

  // Calculate times first for conflict check
  const departureTime = scheduledDepartureTime || new Date().toISOString();
  const departureDate = new Date(departureTime);
  const arrivalTimeCalc = new Date(departureDate.getTime() + durationHours * 60 * 60 * 1000);

  // Check for scheduling conflicts before booking
  const { available, conflictingActivity } = await checkTimeSlotAvailable(
    userId,
    departureDate,
    arrivalTimeCalc
  );

  if (!available) {
    throw new Error(
      `Time slot conflict: You have "${conflictingActivity?.title}" scheduled during this travel time.`
    );
  }

  // Start transaction-like operations
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, cash, display_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    console.error('Profile fetch error:', profileError);
    throw new Error(`Failed to fetch profile: ${profileError.message}`);
  }
  
  if (!profile) {
    throw new Error("Profile not found for this user");
  }

  // Determine if travel starts immediately or is scheduled for later
  const now = new Date();
  const startsImmediately = departureDate <= now;
  
  // Deduct cost and set travel status if starting immediately
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ 
      cash: (profile.cash || 0) - cost,
      is_traveling: startsImmediately,
      travel_arrives_at: startsImmediately ? arrivalTimeCalc.toISOString() : null,
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

  const fromCityName = fromCity ? `${fromCity.name}, ${fromCity.country}` : "Unknown";
  const toCityName = toCity ? `${toCity.name}, ${toCity.country}` : "Unknown";

  // Create travel history entry
  const status = startsImmediately ? 'in_progress' : 'scheduled';
  const travelDurationHoursStored = Math.max(1, Math.ceil(durationHours));
  
  const { data: travelHistory, error: historyError } = await supabase
    .from("player_travel_history")
    .insert({
      user_id: userId,
      from_city_id: fromCityId,
      to_city_id: toCityId,
      transport_type: transportType,
      cost_paid: cost,
      // DB column is integer; durationHours can be fractional (e.g. 3.9)
      travel_duration_hours: travelDurationHoursStored,
      departure_time: departureTime,
      scheduled_departure_time: departureTime,
      arrival_time: arrivalTimeCalc.toISOString(),
      status,
    })
    .select()
    .single();

  if (historyError) throw historyError;

  // Create scheduled activity to block the time slot
  const { error: activityError } = await (supabase as any)
    .from('player_scheduled_activities')
    .insert({
      user_id: userId,
      profile_id: profile.id,
      activity_type: 'travel',
      status: startsImmediately ? 'in_progress' : 'scheduled',
      scheduled_start: departureDate.toISOString(),
      scheduled_end: arrivalTimeCalc.toISOString(),
      title: `Travel: ${fromCityName} → ${toCityName}`,
      description: `${transportType} journey (${durationHours}h)`,
      location: toCityName,
      metadata: {
        travel_history_id: travelHistory.id,
        from_city_id: fromCityId,
        to_city_id: toCityId,
        transport_type: transportType,
      },
    });

  if (activityError) {
    console.warn('Failed to create scheduled activity for travel:', activityError);
  }

  // Log activity
  
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
