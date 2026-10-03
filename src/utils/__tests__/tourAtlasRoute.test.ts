import { describe, expect, it } from 'vitest';
import { findUnmatchedRouteStops, orderRouteVenues } from '../tourAtlasRoute';

describe('atlas route handoff', () => {
  const venues = [
    { cityId: 'london', venueId: 'l1' },
    { cityId: 'paris', venueId: 'p1' },
    { cityId: 'berlin', venueId: 'b1' },
  ];

  it('preserves selected stop order instead of geographic or capacity ordering', () => {
    expect(orderRouteVenues(venues, ['berlin', 'london', 'paris'])
      .map(venue => venue.cityId)).toEqual(['berlin', 'london', 'paris']);
  });

  it('excludes venues outside the selected route', () => {
    expect(orderRouteVenues(venues, ['paris'])).toEqual([venues[1]]);
  });

  it('identifies all stops that cannot be booked', () => {
    expect(findUnmatchedRouteStops(['berlin', 'rome', 'rome', 'paris'], venues))
      .toEqual(['rome']);
  });

  it('does not mark a stop as covered by a venue in a different city', () => {
    expect(findUnmatchedRouteStops(['rome'], venues)).toEqual(['rome']);
  });
});
