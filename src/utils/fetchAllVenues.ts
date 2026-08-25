import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 1000;

type OrderSpec = { column: string; ascending?: boolean };
type VenueForCityFallback = { city_id?: string | null; [key: string]: unknown };
type CityFallbackRow = { id: string; name: string; country: string | null; timezone: string | null };

async function fetchVenuePages<T>(select: string, order: OrderSpec): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  // Hard safety bound so a bad query can never loop forever.
  for (let page = 0; page < 50; page++) {
    const { data, error } = await supabase
      .from("venues")
      .select(select)
      .order(order.column, { ascending: order.ascending ?? true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    const batch = (data ?? []) as unknown as T[];
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

async function fetchPlainVenues<T>(order: OrderSpec): Promise<T[]> {
  try {
    return await fetchVenuePages<T>("*", order);
  } catch (error) {
    // A stale generated client/schema can also leave callers ordering by a
    // column that is no longer exposed. Name is present on every venue and is a
    // safe deterministic fallback so the whole Gigs page does not become unusable.
    if (order.column === "name") throw error;
    console.warn("Venue ordering failed; retrying with venue name", { order, error });
    return await fetchVenuePages<T>("*", { column: "name", ascending: true });
  }
}

async function hydrateVenueCities<T>(rows: T[], select: string): Promise<T[]> {
  const venueRows = rows as unknown as VenueForCityFallback[];
  const cityIds = [...new Set(
    venueRows
      .map((row) => row.city_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  )];

  if (cityIds.length === 0) return rows;

  const cityById = new Map<string, CityFallbackRow>();
  for (let from = 0; from < cityIds.length; from += PAGE_SIZE) {
    const chunk = cityIds.slice(from, from + PAGE_SIZE);
    const { data, error } = await supabase
      .from("cities")
      .select("id,name,country,timezone")
      .in("id", chunk);

    if (error) throw error;
    for (const city of (data ?? []) as CityFallbackRow[]) cityById.set(city.id, city);
  }

  // Existing callers use both `cities!...` and `city:cities(...)` aliases.
  const relationKey = /\bcity\s*:\s*cities\b/.test(select) ? "city" : "cities";
  return venueRows.map((row) => ({
    ...row,
    [relationKey]: row.city_id ? cityById.get(row.city_id) ?? null : null,
  })) as unknown as T[];
}

/**
 * Fetches every venue row, paging past Supabase's 1000-row response cap.
 * Without this, players only ever see the first 1000 venues in the world.
 *
 * PostgREST embedded relationships can temporarily disappear from the schema
 * cache after migrations. Venue browsing is core gameplay, so city embedding
 * has a resilient fallback that fetches venues and cities separately instead
 * of failing the entire Gigs/Tours screen.
 */
export async function fetchAllVenues<T = any>(
  select: string,
  order: OrderSpec = { column: "name", ascending: true },
): Promise<T[]> {
  try {
    return await fetchVenuePages<T>(select, order);
  } catch (error) {
    if (!/\bcities\b/.test(select)) throw error;

    console.warn("Embedded venue city relationship failed; using resilient city hydration", { error });
    const plainVenues = await fetchPlainVenues<T>(order);
    return await hydrateVenueCities(plainVenues, select);
  }
}
