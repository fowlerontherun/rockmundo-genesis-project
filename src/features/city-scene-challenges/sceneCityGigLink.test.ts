import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { citySceneGigBookingHref } from './sceneCityGigLink';

const city = '20000000-0000-0000-0000-000000000071';

describe('City Scene local gig routes', () => {
  it('deep-links a valid city to the existing venue filter', () => {
    const link = citySceneGigBookingHref(city);
    const url = new URL(link, 'https://rockmundo.uk');
    expect(url.pathname).toBe('/gig-booking');
    expect(url.searchParams.get('cityId')).toBe(city);
  });

  it('never injects arbitrary URL strings or invalid IDs', () => {
    for (const value of [null, undefined, '', 'not-a-city', city + '&country=Other', '/gigs']) {
      expect(citySceneGigBookingHref(value)).toBe('/gig-booking');
    }
  });

  it('connects the verified gig objective and monthly guide, without scoring from navigation', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/pages/CitySceneChallenges.tsx'), 'utf8');
    const monthly = readFileSync(resolve(process.cwd(), 'src/features/city-scene-challenges/SceneMonthlyActions.tsx'), 'utf8');
    const booking = readFileSync(resolve(process.cwd(), 'src/pages/GigBooking.tsx'), 'utf8');
    expect(page).toContain("objective.action_type === 'gig:verified_performance' ? citySceneGigBookingHref(board.city_id)");
    expect(monthly).toContain("route === '/gig-booking' ? citySceneGigBookingHref(cityId) : route");
    expect(booking).toContain("searchParams.get('cityId')");
    expect(booking).toContain("v.city_id === requestedCityId");
    expect(monthly).not.toContain('claim_scene_reward');
    expect(page).not.toContain("rpc('scene_process_completed_action'");
  });
});
