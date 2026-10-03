/** Keep atlas tour stop ordering independent of venue ranking. */
export function orderRouteVenues<T extends { cityId: string }>(
  venues: T[],
  cityIds: string[],
): T[] {
  const positions = new Map(cityIds.map((id, index) => [id, index]));
  return venues.filter(venue => positions.has(venue.cityId))
    .sort((a, b) => positions.get(a.cityId)! - positions.get(b.cityId)!);
}

/** A selected stop without a matched venue must never be silently dropped. */
export function findUnmatchedRouteStops(
  cityIds: string[],
  venues: ReadonlyArray<{ cityId: string }>,
): string[] {
  const matched = new Set(venues.map(venue => venue.cityId));
  return [...new Set(cityIds)].filter(id => !matched.has(id));
}
