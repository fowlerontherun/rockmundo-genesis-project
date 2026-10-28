import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SceneDiscovery } from './SceneDiscovery';

describe('City Scene discovery', () => {
  it('shows working navigation without implying discovery earns rewards', () => {
    const html = renderToStaticMarkup(<MemoryRouter><SceneDiscovery cityId="20000000-0000-0000-0000-000000000071" cityName="Portsmouth" /></MemoryRouter>);
    expect(html).toContain('Discover the Portsmouth music scene');
    expect(html).toContain('/social/players');
    expect(html).toContain('/bands/browse');
    expect(html).toContain('/gig-booking');
    expect(html).toContain('/cities/20000000-0000-0000-0000-000000000071');
    expect(html).toContain('page visits do not award Scene Points');
    expect(html).not.toContain('Claim XP');
  });
  it('mounts discovery on the city board without a credit RPC', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/pages/CitySceneChallenges.tsx'), 'utf8');
    const discovery = readFileSync(resolve(process.cwd(), 'src/features/city-scene-challenges/SceneDiscovery.tsx'), 'utf8');
    expect(page).toContain('<SceneDiscovery cityId={board.city_id} cityName={board.city_name} />');
    expect(discovery).not.toContain('supabase');
    expect(discovery).not.toContain('claim_scene_reward');
  });
});
