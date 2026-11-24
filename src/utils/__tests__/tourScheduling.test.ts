import { describe, expect, it } from 'vitest';
import { DEFAULT_WIZARD_STATE, type VenueMatch } from '@/lib/tourTypes';
import {
  calculateTourCostEstimate,
  calculateTourDurationDays,
  calculateTourEndDate,
  generateTourSchedule,
} from '@/utils/tourCalculations';

const start = new Date('2026-12-01T00:00:00.000Z');
const isoDates = (dates: Date[]) => dates.map(date => date.toISOString().slice(0, 10));

describe('tour gig-date scheduling', () => {
  it('books the requested number of gigs, with rest days only after each full run', () => {
    const dates = generateTourSchedule(start, 8, 3, 2);

    expect(isoDates(dates)).toEqual([
      '2026-12-01', '2026-12-02', '2026-12-03',
      '2026-12-06', '2026-12-07', '2026-12-08',
      '2026-12-11', '2026-12-12',
    ]);
    expect(calculateTourDurationDays(8, 3, 2)).toBe(12);
    expect(calculateTourEndDate(start, 8, 3, 2).toISOString().slice(0, 10)).toBe('2026-12-12');
  });

  it('does not append a rest block when the tour ends exactly at a run boundary', () => {
    expect(isoDates(generateTourSchedule(start, 6, 3, 2))).toEqual([
      '2026-12-01', '2026-12-02', '2026-12-03',
      '2026-12-06', '2026-12-07', '2026-12-08',
    ]);
    expect(calculateTourDurationDays(6, 3, 2)).toBe(8);
    expect(calculateTourDurationDays(1, 3, 2)).toBe(1);
    expect(calculateTourDurationDays(0, 3, 2)).toBe(0);
  });

  it('keeps calendar dates correct across a year boundary', () => {
    const dates = generateTourSchedule(new Date('2026-12-29T00:00:00.000Z'), 5, 2, 1);
    expect(isoDates(dates)).toEqual([
      '2026-12-29', '2026-12-30', '2027-01-01', '2027-01-02', '2027-01-04',
    ]);
  });

  it('charges tour bus hire for the actual scheduled calendar span', () => {
    const venues: VenueMatch[] = Array.from({ length: 5 }, (_, index) => ({
      venueId: `venue-${index}`,
      venueName: `Venue ${index}`,
      cityId: `city-${index}`,
      cityName: `City ${index}`,
      country: 'United Kingdom',
      capacity: 100,
      venueType: 'club',
      basePayment: 0,
      bookingFee: 0,
      estimatedTicketRevenue: 0,
      date: '',
    }));

    const costs = calculateTourCostEstimate(venues, {
      ...DEFAULT_WIZARD_STATE,
      travelMode: 'tour_bus',
      tourBusDailyCost: 100,
      consecutiveShowCount: 2,
      minRestDays: 1,
    }, 0, 0);

    // Gig dates 1, 2, 4, 5, 7: seven paid tour days, not five gigs or 30 days.
    expect(costs.showCount).toBe(5);
    expect(costs.tourBusCosts).toBe(700);
  });
});
