import { describe, expect, it } from 'vitest';
import {
  calculateAttendanceForecast,
  getRecommendedGigTicketPrice,
  normalizeVenuePrestigeForTickets,
} from '../gigPerformanceCalculator';

describe('gig ticket pricing for starter venues', () => {
  it('normalises both prestige scales before ticketing uses them', () => {
    expect(normalizeVenuePrestigeForTickets(1)).toBe(1);
    expect(normalizeVenuePrestigeForTickets(8)).toBe(8);
    expect(normalizeVenuePrestigeForTickets(82)).toBe(8);
    expect(normalizeVenuePrestigeForTickets(100)).toBe(10);
  });

  it('recommends cheap tickets for small low-prestige venues', () => {
    expect(getRecommendedGigTicketPrice(30, 1)).toBe(5);
    expect(getRecommendedGigTicketPrice(100, 1)).toBe(5);
    expect(getRecommendedGigTicketPrice(200, 2)).toBe(6);
    expect(getRecommendedGigTicketPrice(500, 3)).toBe(11);
  });

  it('does not turn legacy famous prestige values into absurd ticket prices', () => {
    expect(getRecommendedGigTicketPrice(350, 82)).toBe(22);
    expect(getRecommendedGigTicketPrice(5000, 96)).toBe(34);
  });

  it('gives starter rooms walk-up demand while keeping price sensitivity', () => {
    const cheap = calculateAttendanceForecast(0, 0, 30, 1, 5, 0);
    const expensive = calculateAttendanceForecast(0, 0, 30, 1, 20, 0);

    expect(cheap.realistic).toBeGreaterThan(expensive.realistic);
    expect(cheap.realistic).toBeGreaterThanOrEqual(6);
    expect(cheap.realistic).toBeLessThan(30);
  });
});