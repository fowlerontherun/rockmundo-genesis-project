import { supabase } from "@/integrations/supabase/client";
import { MINIMUM_TRAVEL_DURATION_HOURS, type CityWithCoords, type TravelOption } from "@/utils/dynamicTravel";

export interface TravelDestinationQuote {
  city: CityWithCoords;
  distanceKm: number;
  options: TravelOption[];
  cheapestOption: TravelOption | null;
  fastestOption: TravelOption | null;
}

function transportMultipliers(rating: number) {
  const clamped = Math.max(0, Math.min(100, rating));
  return {
    cost: 1.1 - clamped * 0.002,
    duration: 1.08 - clamped * 0.0016,
  };
}

/**
 * Applies the City Hall transport rating to quoted travel options.
 *
 * This keeps the existing travel system behaviour intact at the neutral score of
 * 50. The average transport quality of the departure and destination cities is
 * used, so investing in either end of a route makes that route modestly cheaper
 * and faster. The server-side city-development contract uses the same bounded
 * formula.
 *
 * Travel booking itself is still a legacy client-orchestrated flow. A later
 * governance hardening pass should move the final quote/debit into one RPC; this
 * helper ensures the player-visible quote and current booking amount stay in sync
 * until that migration is done.
 */
export async function applyCityDevelopmentToTravelQuotes(
  fromCityId: string,
  destinations: TravelDestinationQuote[],
): Promise<TravelDestinationQuote[]> {
  if (!destinations.length) return destinations;

  const cityIds = [fromCityId, ...destinations.map((destination) => destination.city.id)];
  const { data, error } = await (supabase as any)
    .from("city_development")
    .select("city_id, transport")
    .in("city_id", cityIds);

  if (error) {
    console.warn("Could not load city transport ratings; using neutral travel quotes", error);
    return destinations;
  }

  const ratings = new Map<string, number>(
    (data ?? []).map((row: any) => [String(row.city_id), Number(row.transport ?? 50)]),
  );
  const fromRating = ratings.get(fromCityId) ?? 50;

  return destinations.map((destination) => {
    const toRating = ratings.get(destination.city.id) ?? 50;
    const averageRating = (fromRating + toRating) / 2;
    const multipliers = transportMultipliers(averageRating);
    const options = destination.options.map((option) => {
      if (!option.available) return option;
      return {
        ...option,
        cost: Math.max(0, Math.round(option.cost * multipliers.cost)),
        durationHours: Math.max(
          MINIMUM_TRAVEL_DURATION_HOURS,
          Math.round(option.durationHours * multipliers.duration * 10) / 10,
        ),
      };
    });
    const available = options.filter((option) => option.available);

    return {
      ...destination,
      options,
      cheapestOption: available.length
        ? available.reduce((best, option) => option.cost < best.cost ? option : best)
        : null,
      fastestOption: available.length
        ? available.reduce((best, option) => option.durationHours < best.durationHours ? option : best)
        : null,
    };
  });
}
