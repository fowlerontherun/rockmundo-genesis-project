import { supabase } from "@/integrations/supabase/client";
import { subHours } from "date-fns";

export const CHARTER_FLIGHT_COST = 40000;

export interface CharterFlightResult {
  success: boolean;
  message: string;
  newBalance?: number;
}

export async function bookCharterFlight(
  userId: string,
  currentBalance: number,
  gigId: string,
  gigDate: Date,
  destinationCityId: string,
  destinationCityName: string,
  originCityId: string,
  originCityName: string
): Promise<CharterFlightResult> {
  // Check if user has enough coins
  if (currentBalance < CHARTER_FLIGHT_COST) {
    return {
      success: false,
      message: `You need $${CHARTER_FLIGHT_COST.toLocaleString()} for a charter flight. You only have $${currentBalance.toLocaleString()}.`,
    };
  }

  // Calculate arrival time (1 hour before gig)
  const arrivalTime = subHours(gigDate, 1);
  const departureTime = subHours(arrivalTime, 2); // 2 hour flight

  // Start transaction - deduct cash
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ 
      cash: currentBalance - CHARTER_FLIGHT_COST,
      current_city_id: destinationCityId,
      travel_status: 'arrived',
      arrival_time: arrivalTime.toISOString()
    })
    .eq("id", userId);

  if (updateError) {
    console.error("Failed to update profile:", updateError);
    return {
      success: false,
      message: "Failed to book charter flight. Please try again.",
    };
  }

  // Log the travel
  await supabase.from("player_travel_history").insert({
    user_id: userId,
    from_city_id: originCityId,
    to_city_id: destinationCityId,
    transport_type: "private_charter",
    cost_paid: CHARTER_FLIGHT_COST,
    departure_time: departureTime.toISOString(),
    arrival_time: arrivalTime.toISOString(),
    travel_duration_hours: 2,
    status: "completed",
  });

  // Create activity feed entry
  await supabase.from("activity_feed").insert({
    user_id: userId,
    activity_type: "travel",
    message: `Chartered private jet from ${originCityName} to ${destinationCityName} for gig`,
    earnings: -CHARTER_FLIGHT_COST,
    metadata: {
      transport_type: "private_charter",
      gig_id: gigId,
      origin_city: originCityName,
      destination_city: destinationCityName,
    },
  });

  return {
    success: true,
    message: `Charter flight booked! You'll arrive in ${destinationCityName} 1 hour before the show.`,
    newBalance: currentBalance - CHARTER_FLIGHT_COST,
  };
}
