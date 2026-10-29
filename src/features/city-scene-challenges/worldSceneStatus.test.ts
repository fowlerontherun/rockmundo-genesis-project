import { describe, expect, it } from 'vitest';
import { activeWorldScenes, isWorldSceneStatus } from './worldSceneStatus';

const city = '20000000-0000-0000-0000-000000000091';
const sample: unknown = {
  cities: [{ city_id: city, cadence: 'weekly', ends_at: '2026-11-02T00:00:00Z', confirmed_stage: 25 }],
};

describe('World Scene mural status validation', () => {
  it('accepts only the four public aggregate fields and milestone values', () => {
    expect(isWorldSceneStatus(sample)).toBe(true);
    expect(isWorldSceneStatus({ cities: [] })).toBe(true);
    expect(isWorldSceneStatus({ cities: [{ city_id: city, cadence: 'weekly', ends_at: '2026-11-02T00:00:00Z', confirmed_stage: 0 }] })).toBe(true);
    expect(isWorldSceneStatus({ cities: [{ city_id: city, cadence: 'weekly', ends_at: '2026-11-02T00:00:00Z', confirmed_stage: 17 }] })).toBe(false);
    expect(isWorldSceneStatus({ cities: [{ city_id: city, cadence: 'daily', ends_at: '2026-11-02T00:00:00Z', confirmed_stage: 25 }] })).toBe(false);
    expect(isWorldSceneStatus({ cities: [{ city_id: city, cadence: 'weekly', ends_at: 'invalid', confirmed_stage: 25 }] })).toBe(false);
    expect(isWorldSceneStatus({ cities: [{ city_id: 'invalid', cadence: 'weekly', ends_at: '2026-11-02T00:00:00Z', confirmed_stage: 25 }] })).toBe(false);
  });

  it('rejects private keys, excess cities, duplicate city identities and malformed rows', () => {
    expect(isWorldSceneStatus({ ...sample as object, account_id: 'private' })).toBe(false);
    expect(isWorldSceneStatus({ cities: [{ ...(sample as { cities: object[] }).cities[0], source_event_id: 'private' }] })).toBe(false);
    expect(isWorldSceneStatus({ cities: Array(201).fill((sample as { cities: object[] }).cities[0]) })).toBe(false);
    expect(isWorldSceneStatus({ cities: Array(2).fill((sample as { cities: object[] }).cities[0]) })).toBe(false);
    expect(isWorldSceneStatus({ cities: [null] })).toBe(false);
  });

  it('drops UTC-expired campaigns from the map, including exact rollover boundary', () => {
    if (!isWorldSceneStatus(sample)) throw new Error('Invalid test fixture');
    expect(activeWorldScenes(sample, Date.parse('2026-11-01T23:59:59Z'))[city]?.confirmed_stage).toBe(25);
    expect(activeWorldScenes(sample, Date.parse('2026-11-02T00:00:00Z'))[city]).toBeUndefined();
    expect(activeWorldScenes(sample, NaN)).toEqual({});
  });
});
