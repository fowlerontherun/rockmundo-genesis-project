import { describe, expect, it } from 'vitest';
import { getGigBookingPlayerError } from '../gigBookingErrors';

describe('getGigBookingPlayerError', () => {
  it.each([
    ['gig_booking_forbidden', 'Permission denied'],
    ['gig_booking_insufficient_funds', 'Insufficient funds'],
    ['gig_booking_setlist_invalid', 'Setlist unavailable'],
    ['gig_booking_past_date', 'Invalid date'],
    ['gig_booking_band_conflict', 'Band scheduling conflict'],
    ['gig_booking_venue_conflict', 'Venue unavailable'],
    ['gig_booking_venue_cooldown', 'Venue on cooldown'],
    ['gig_booking_band_lockout', 'Band is busy'],
    ['gig_booking_rider_invalid', 'Rider unavailable'],
  ])('maps %s without exposing database text', (message, title) => {
    expect(getGigBookingPlayerError({ message, details: 'secret SQL' })).toEqual(expect.objectContaining({ title }));
    expect(getGigBookingPlayerError({ message, details: 'secret SQL' }).description).not.toContain('secret SQL');
  });

  it('identifies a missing RPC migration', () => {
    expect(getGigBookingPlayerError({ code: 'PGRST202' }).title).toBe('Booking service unavailable');
  });
});
