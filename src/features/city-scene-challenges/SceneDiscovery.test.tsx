import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SceneDiscovery, getSceneDiscoveryLinks } from './SceneDiscovery';
import { parseCityBandFilter } from './sceneCityFilter';

describe('City Scene discovery', () => {
  it('shows working navigation without implying discovery earns rewards', () => {
    const html = renderToStaticMarkup(<MemoryRouter><SceneDiscovery cityId="20000000-0000-0000-0000-000000000071" cityName="Portsmouth" /></MemoryRouter>);
    expect(html).toContain('Discover the Portsmouth music scene');
    expect(html).toContain('/social/players/discover?mode=musicians&amp;city=Portsmouth');
    expect(html).toContain('/bands/browse?city=20000000-0000-0000-0000-000000000071');
    expect(html).toContain('/gig-booking');
    expect(html).toContain('/cities/20000000-0000-0000-0000-000000000071');
    expect(html).toContain('page visits do not award Scene Points');
    expect(html).not.toContain('Claim XP');
  });
  it('URL-encodes city names and filters bands by stable UUID', () => {
    const links = getSceneDiscoveryLinks('20000000-0000-0000-0000-000000000071', "St John's & Port");
    const musicians = new URL(links.musicians, 'https://rockmundo.uk');
    const bands = new URL(links.bands, 'https://rockmundo.uk');
    expect(musicians.pathname).toBe('/social/players/discover');
    expect(musicians.searchParams.get('mode')).toBe('musicians');
    expect(musicians.searchParams.get('city')).toBe("St John's & Port");
    expect(bands.searchParams.get('city')).toBe('20000000-0000-0000-0000-000000000071');
  });

  it('rejects malformed band city filters and supports browsing all cities', () => {
    expect(parseCityBandFilter(null)).toEqual({ cityId: null, invalidCity: false });
    expect(parseCityBandFilter('20000000-0000-0000-0000-000000000071')).toEqual({
      cityId: '20000000-0000-0000-0000-000000000071', invalidCity: false,
    });
    for (const invalid of ['', 'not-a-city', '20000000-0000-0000-0000-000000000071,other', '00000000-0000-0000']) {
      expect(parseCityBandFilter(invalid)).toEqual({ cityId: null, invalidCity: true });
    }
  });

  it('filters bands server-side before the result limit', () => {
    const browser = readFileSync(resolve(process.cwd(), 'src/pages/BandBrowser.tsx'), 'utf8');
    expect(browser).toContain('parseCityBandFilter(searchParams.get("city"))');
    expect(browser).toContain('queryKey: ["band-search", debouncedQuery, cityId]');
    expect(browser).toContain('query.eq("home_city_id", cityId)');
    expect(browser).toContain('Show all cities');
    expect(browser).toContain('Touring bands may be based elsewhere.');
  });

  it('mounts discovery on the city board without a credit RPC', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/pages/CitySceneChallenges.tsx'), 'utf8');
    const discovery = readFileSync(resolve(process.cwd(), 'src/features/city-scene-challenges/SceneDiscovery.tsx'), 'utf8');
    expect(page).toContain('<SceneDiscovery cityId={board.city_id} cityName={board.city_name} />');
    expect(discovery).not.toContain('supabase');
    expect(discovery).not.toContain('claim_scene_reward');
  });
});
