import { describe, expect, it } from 'vitest';
import { resolveVenueProfile, stagePosition, stageTransform, VENUE_TYPES } from './venueProfile';

describe('game venue profiles', () => {
  it('maps every game type and legacy alias without name overrides', () => {
    for (const [type, [, capacity]] of Object.entries(VENUE_TYPES)) {
      const profile = resolveVenueProfile({ type, capacity, name: 'Stadium Club Festival' });
      expect(profile.kind).toBe(type);
      expect(profile.capacity).toBe(capacity);
    }
    for (const [type, kind] of Object.entries({ arena: 'indoor_arena', club: 'rock_club', theater: 'theatre', amphitheater: 'amphitheatre' })) expect(resolveVenueProfile({ type }).kind).toBe(kind);
    expect(resolveVenueProfile({ type: 'large_venue', capacity: 7000 }).kind).toBe('indoor_arena');
  });
  it('sizes the physical deck and keeps performers on its floor', () => {
    let previous = 0;
    for (const capacity of [40, 300, 2000, 10000, 65000]) {
      const p = resolveVenueProfile({ type: 'dive_bar', capacity });
      expect(p.kind).toBe('dive_bar'); expect(p.stageWidth).toBeGreaterThan(previous); previous = p.stageWidth;
      for (const u of [0, .5, 1]) for (const v of [0, .5, 1]) {
        const [x, y, z] = stagePosition(p, u, v);
        expect(Math.abs(x)).toBeLessThan(p.stageWidth / 2);
        expect(y).toBe(p.stageHeight); expect(z).toBeLessThan(.65); expect(z).toBeGreaterThan(.65 - p.stageDepth);
      }
      expect(stageTransform(p, [0, .9, .65])).toEqual([0, p.stageHeight, .65]);
    }
  });
  it('uses bounded defaults for missing and malformed capacities', () => {
    for (const capacity of [undefined, null, 0, -1, NaN, Infinity]) {
      const p = resolveVenueProfile({ type: 'cafe_stage', capacity }); expect(p.capacity).toBe(70); expect(p.production).toBe('portable');
    }
    expect(resolveVenueProfile({ capacity: 1e20 }).capacity).toBe(150000);
    for (const type of ['constructor', '__proto__', 'unknown_type']) expect(resolveVenueProfile({ type, capacity: 500 }).kind).toBe('rock_club');
    expect(resolveVenueProfile({ type: 'festival_tent' }).outdoor).toBe(false);
    expect(resolveVenueProfile({ type: 'amphitheatre' }).seating).toBe(true);
  });
});
