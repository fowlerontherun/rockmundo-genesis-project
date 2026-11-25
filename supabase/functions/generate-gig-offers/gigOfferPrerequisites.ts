/** A global offer run must never manufacture a promoter when none is active. */
export function requireGigOfferSources<T, U>(
  promoters: T[] | null,
  venues: U[] | null,
): { promoters: T[]; venues: U[] } {
  if (!promoters?.length) throw new Error("no_active_gig_promoters");
  if (!venues?.length) throw new Error("no_available_gig_venues");
  return { promoters, venues };
}
