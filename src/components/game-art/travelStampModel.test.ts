import { describe, expect, it } from 'vitest';
import { recentDestinationStamps, type StampJourney } from './travelStampModel';
const trip = (id: string, city: string | null, status = 'completed', arrival = '2026-10-20T10:00:00Z'): StampJourney => ({ id, to_city_id: city, to_city: { name: 'Same city name', country: 'Country' }, arrival_time: arrival, status });
describe('travel passport evidence', () => {
  it('only grants stamps for completed journeys with a destination and valid arrival', () => {
    expect(recentDestinationStamps([trip('1', 'city'), trip('2', 'other', 'cancelled'), trip('3', 'next', 'in_progress'), trip('4', null), trip('5', 'invalid', 'completed', 'bad')]).map(t => t.id)).toEqual(['1']);
  });
  it('keeps the latest visit per city ID while distinguishing namesakes', () => {
    const journeys = [trip('old', 'a', 'completed', '2026-10-10T10:00:00Z'), trip('new', 'a'), trip('other', 'b')];
    expect(recentDestinationStamps(journeys).map(t => t.id)).toEqual(['new', 'other']);
    expect(journeys[0].id).toBe('old');
  });
  it('bounds the stamp shelf while keeping full history untouched', () => {
    const journeys = Array.from({ length: 10 }, (_, i) => trip(String(i), String(i)));
    expect(recentDestinationStamps(journeys)).toHaveLength(6);
    expect(journeys).toHaveLength(10);
  });
});
