export interface GigBookingErrorLike {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

const messages: Array<[string, string, string]> = [
  ['gig_booking_forbidden', 'Permission denied', 'You do not have permission to manage gigs for this band.'],
  ['gig_booking_insufficient_funds', 'Insufficient funds', 'The band does not have enough funds for this booking.'],
  ['gig_booking_setlist_invalid', 'Setlist unavailable', 'That setlist is no longer valid. Choose an active setlist with at least six songs.'],
  ['gig_booking_past_date', 'Invalid date', 'Choose a gig date and time in the future.'],
  ['gig_booking_same_day_different_venue', 'Same-day venue conflict', 'Your band already has a show that day at another venue. Multiple shows in one day must all be at the same venue.'],
  ['gig_booking_same_day_gap_too_short', 'Not enough time between shows', 'Same-venue shows on the same day must have at least four full hours between them.'],
  ['gig_booking_band_conflict', 'Band scheduling conflict', 'A band member or the band already has a conflicting activity.'],
  ['gig_booking_venue_conflict', 'Venue unavailable', 'The venue is already booked during part of that time.'],
  ['gig_booking_venue_cooldown', 'Venue on cooldown', 'Your band played here recently. Choose another venue or a later date.'],
  ['gig_booking_band_lockout', 'Band is busy', 'The band is currently locked out from booking another performance.'],
  ['gig_booking_rider_invalid', 'Rider unavailable', 'That rider is not valid for this band. Choose another rider or no rider.'],
  ['gig_booking_operator_required', 'Ticket operator required', 'Choose an available ticket operator for this venue.'],
  ['gig_booking_request_conflict', 'Duplicate request', 'This booking request was already used with different details. Please reopen the dialog.'],
  ['gig_booking_profile_missing', 'Account setup incomplete', 'Your active player profile could not be resolved. Please reload and try again.'],
  ['Cannot perform this action while traveling', 'Travel in progress', 'You cannot make this booking while your character is currently travelling. Try again after arrival.'],
];

export function getGigBookingPlayerError(error: GigBookingErrorLike) {
  const diagnostic = [error.message, error.details, error.hint].filter(Boolean).join(' ');
  const match = messages.find(([key]) => diagnostic.includes(key));
  if (match) return { title: match[1], description: match[2] };

  if (error.code === '42883' || error.code === 'PGRST202') {
    return {
      title: 'Booking service unavailable',
      description: 'The gig-booking database update is not installed yet. Please contact an administrator.',
    };
  }
  const reference = error.code && /^[A-Z0-9]{4,10}$/.test(error.code) ? ` Reference: ${error.code}.` : '';
  return {
    title: 'Booking failed',
    description: `We could not schedule that gig. No booking fee was charged.${reference} Please try again later.`,
  };
}
