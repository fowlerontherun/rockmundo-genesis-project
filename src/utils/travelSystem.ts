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
      destinationCityId: bookingData.toCityId,
      transportType: bookingData.transportType,
      scheduledDepartureTime: bookingData.scheduledDepartureTime ?? null,
      idempotencyKey,
    },
  });

  if (error) {
    throw new Error(data?.error || error.message || "Unable to book travel");
  }
  if (!data?.success || !data?.result) {
    throw new Error(data?.error || "Unable to book travel");
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
