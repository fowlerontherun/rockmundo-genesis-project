/**
 * Gig Booking already accepts cityId query parameter and resolves local venues.
 * A malformed city identifier falls back to the generic booking page.
 * Navigation never grants Scene Points or books a gig.
 */
export function citySceneGigBookingHref(cityId: string | null | undefined): string {
  if (!cityId || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(cityId)) {
    return '/gig-booking';
  }
  return '/gig-booking?cityId=' + encodeURIComponent(cityId);
}
