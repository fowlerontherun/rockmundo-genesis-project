import { supabase } from "@/integrations/supabase/client";

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
  // Retained for compatibility with existing desktop/mobile callers. The
  // authoritative booking endpoint does not trust these browser-owned fields.
  profileId: string;
  fromCityId: string;
  toCityId: string;
  routeId: string;
  transportType: string;
  cost: number;
  durationHours: number;
  comfortRating: number;
  scheduledDepartureTime?: string;
}

export interface AuthoritativeTravelResult {
  bookingId: string;
  travelHistoryId: string;
  profileId: string;
  fromCityId: string;
  fromCityName: string;
  toCityId: string;
  toCityName: string;
  transportType: string;
  rawFare: number;
  fare: number;
  travelTax: number;
  totalCost: number;
  rawDurationHours: number;
  durationHours: number;
  averageTransportRating: number;
  transportCostMultiplier: number;
  transportDurationMultiplier: number;
  scheduledDepartureTime: string;
  arrivalTime: string;
  status: "scheduled" | "in_progress";
  xpGained: number;
  idempotent?: boolean;
}

export interface TravelBookingResponse extends AuthoritativeTravelResult {
  success: true;
  message: string;
  newLocation: string | null;
}

const pendingTravelIdempotency = new Map<string, string>();

const travelRequestKey = (bookingData: TravelBookingData) =>
  [
    bookingData.toCityId,
    bookingData.transportType.toLowerCase(),
    bookingData.scheduledDepartureTime ?? "immediate",
  ].join("|");

const TRAVEL_ERROR_MESSAGES: Array<[string, string]> = [
  ["travel_departure_too_soon", "Choose a departure at least 30 minutes from now."],
  ["travel_schedule_conflict", "That journey overlaps another scheduled activity. Choose a different departure time."],
  ["travel_activity_conflict", "Your character is busy during this departure. Finish or reschedule the current activity first."],
  ["travel_already_in_progress", "Your character is already travelling."],
  ["travel_destination_is_current_city", "Your character is already in that city."],
  ["travel_current_city_not_set", "Your character does not currently have a valid city location."],
  ["travel_profile_not_found", "The active character could not be found. Switch character or reload and try again."],
  ["travel_city_not_found", "One of the selected cities is no longer available."],
  ["travel_bus_route_unavailable", "Bus travel is not available for this route."],
  ["travel_train_network_unavailable", "Train travel is not available for this route."],
  ["travel_train_connection_unavailable", "There is no valid rail connection for this route."],
  ["travel_ship_route_unavailable", "Ship travel is not available for this route."],
  ["travel_mode_unavailable_for_distance", "That transport option is not available for this distance."],
  ["insufficient", "You do not have enough available funds for this journey."],
  ["festival_attendance_schedule_locked", "Festival attendance currently locks this travel window."],
];

const friendlyTravelError = (message: string) => {
  const normalised = message.toLowerCase();
  const mapped = TRAVEL_ERROR_MESSAGES.find(([code]) => normalised.includes(code));
  return mapped?.[1] ?? message;
};

const extractFunctionError = async (error: any, data: any): Promise<string> => {
  if (typeof data?.error === "string" && data.error.trim()) {
    return friendlyTravelError(data.error);
  }

  // Supabase FunctionsHttpError keeps the non-2xx response body on context.
  // Reading it here prevents the UI from collapsing every server validation into
  // the unhelpful "Edge Function returned a non-2xx status code" message.
  const response = error?.context;
  if (response && typeof response.clone === "function") {
    try {
      const payload = await response.clone().json();
      if (typeof payload?.error === "string" && payload.error.trim()) {
        return friendlyTravelError(payload.error);
      }
    } catch {
      // Fall through to the SDK error below.
    }
  }

  const fallback = error?.message || "Unable to book travel";
  if (fallback === "Edge Function returned a non-2xx status code") {
    return "Travel could not be booked. Check your departure time, schedule and available funds, then try again.";
  }
  return friendlyTravelError(fallback);
};

/**
 * Legacy preview-only affordability helper.
 *
 * Kept for callers/tests that want a quick UI check, but bookTravel deliberately
 * does not use it. The authoritative server re-resolves the active character,
 * current city, City Hall tax, Transport modifiers and final balance atomically.
 */
export async function validateTravelEligibility(profileId: string, cost: number) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("cash")
    .eq("id", profileId)
    .maybeSingle();

  if (profileError) {
    console.error("Travel eligibility check failed:", profileError);
    throw new Error(`Failed to fetch profile: ${profileError.message}`);
  }

  if (!profile || (profile.cash || 0) < cost) {
    throw new Error("Insufficient funds for this travel");
  }

  return true;
}

export async function getTravelTaxForDeparture(cityId: string, departureTime?: string): Promise<number> {
  if (!cityId) return 0;
  const target = departureTime ?? new Date().toISOString();
  const { data, error } = await (supabase as any)
    .from("city_laws")
    .select("travel_tax,effective_from,effective_until")
    .eq("city_id", cityId)
    .lte("effective_from", target)
    .or(`effective_until.is.null,effective_until.gt.${target}`)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("Travel tax preview unavailable; server will still enforce it", error);
    return 0;
  }

  return Math.max(0, Math.round(Number(data?.travel_tax ?? 0)));
}

export async function bookTravel(bookingData: TravelBookingData): Promise<TravelBookingResponse> {
  if (!bookingData.toCityId || !bookingData.transportType) {
    throw new Error("Destination and transport mode are required");
  }

  const key = travelRequestKey(bookingData);
  const idempotencyKey = pendingTravelIdempotency.get(key) ?? crypto.randomUUID();
  pendingTravelIdempotency.set(key, idempotencyKey);

  const { data, error } = await supabase.functions.invoke("travel-booking", {
    body: {
      profileId: bookingData.profileId,
      destinationCityId: bookingData.toCityId,
      transportType: bookingData.transportType,
      scheduledDepartureTime: bookingData.scheduledDepartureTime ?? null,
      idempotencyKey,
    },
  });

  if (error) {
    throw new Error(await extractFunctionError(error, data));
  }
  if (!data?.success || !data?.result) {
    throw new Error(friendlyTravelError(data?.error || "Unable to book travel"));
  }

  const result = data.result as AuthoritativeTravelResult;
  pendingTravelIdempotency.delete(key);

  return {
    ...result,
    success: true,
    message:
      result.status === "in_progress"
        ? `Travel started to ${result.toCityName}`
        : `Travel booked to ${result.toCityName}`,
    newLocation: result.status === "in_progress" ? result.toCityName : null,
  };
}

export function calculateTravelCost(baseCost: number, comfortRating: number): number {
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
