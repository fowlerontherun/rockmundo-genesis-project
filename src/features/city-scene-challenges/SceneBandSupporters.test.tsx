import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { isSceneBandSupporters, SceneBandSupporters } from './SceneBandSupporters';

const city = '4d4c7bc5-6a19-4c43-bf36-4b8d018e1f0a';
const response = {
  city_id: city,
  cadence: 'weekly',
  entries: [
    { rank: 1, band_name: 'The Starlights', points: 4, verified_events: 2 },
    { rank: 2, band_name: 'Another Band', points: 2, verified_events: 1 },
  ],
  my_bands: [{ band_id: '8d04c1c8-2c2c-4782-9608-92c398e272d3', band_name: 'The Starlights', enabled: true }],
};

describe('City Scene band supporter ranking', () => {
  it('accepts server-owned rank and management lists', () => {
    expect(isSceneBandSupporters(response, city, 'weekly')).toBe(true);
    expect(isSceneBandSupporters({ ...response, entries: [], my_bands: [] }, city, 'weekly')).toBe(true);
  });
  it('rejects mismatched city, cadence, malformed ranks, source IDs and invalid band controls', () => {
    expect(isSceneBandSupporters(response, city, 'daily')).toBe(false);
    expect(isSceneBandSupporters(response, '00000000-0000-0000-0000-000000000000', 'weekly')).toBe(false);
    expect(isSceneBandSupporters({ ...response, entries: [{ ...response.entries[0], rank: 2 }] }, city, 'weekly')).toBe(false);
    expect(isSceneBandSupporters({ ...response, entries: [{ ...response.entries[0], points: -1 }] }, city, 'weekly')).toBe(false);
    expect(isSceneBandSupporters({ ...response, my_bands: [{ ...response.my_bands[0], band_id: 'not-an-id' }] }, city, 'weekly')).toBe(false);
    expect(isSceneBandSupporters({ ...response, my_bands: Array(21).fill(response.my_bands[0]) }, city, 'weekly')).toBe(false);
  });
  it('starts with safe loading and no fabricated band contributions', () => {
    const html = renderToStaticMarkup(<SceneBandSupporters cityId={city} cadence="weekly" refresh={0} />);
    expect(html).toContain('Loading participating bands');
    expect(html).not.toContain('The Starlights');
    expect(html).not.toContain('XP earned');
  });
});
