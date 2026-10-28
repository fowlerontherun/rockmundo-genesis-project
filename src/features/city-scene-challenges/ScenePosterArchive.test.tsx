import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { isCityScenePosterArchive, ScenePosterArchive } from './ScenePosterArchive';
import { ScenePoster } from './ScenePoster';

const city = '57a4970c-74ca-4b1e-8488-62d1d1ef9c23';
const poster = {
  cycle_id: '887e907d-8429-4aa2-8844-6ad083106cfa',
  month_start: '2026-11-01T00:00:00+00:00',
  art_version: 1,
  theme_slug: 'live-music-revival',
  target_total: 12,
  earned_points: 6,
  milestones: [25, 50],
};

describe('City Scene historic poster gallery', () => {
  it('validates a private-data-free server archive and bounded history', () => {
    expect(isCityScenePosterArchive({ city_id: city, posters: [poster] }, city)).toBe(true);
    expect(isCityScenePosterArchive({ city_id: city, posters: [] }, city)).toBe(true);
    expect(isCityScenePosterArchive({ city_id: city, posters: [poster] }, 'fffd970c-74ca-4b1e-8488-62d1d1ef9c23')).toBe(false);
    expect(isCityScenePosterArchive({ city_id: city, posters: Array(25).fill(poster) }, city)).toBe(false);
  });
  it('rejects impossible target, duplicate stages and malformed month identity', () => {
    for (const patch of [
      { target_total: 0 }, { earned_points: -1 },
      { milestones: [25, 25] }, { milestones: [13] },
      { month_start: '2026-11-14T00:00:00Z' }, { month_start: 'invalid' },
      { cycle_id: 'bad-id' }, { art_version: 0 },
    ]) {
      expect(isCityScenePosterArchive({ city_id: city, posters: [{ ...poster, ...patch }] }, city)).toBe(false);
    }
  });
  it('starts with an honest loading state and never fabricates poster milestones', () => {
    const html = renderToStaticMarkup(<ScenePosterArchive cityId={city} cityName="Portsmouth" refresh={0} />);
    expect(html).toContain('Loading the poster wall');
    expect(html).not.toContain('Full reveal');
    expect(html).not.toContain('Reward granted');
  });
  it('historic poster has historic copy and honours persisted milestones only', () => {
    const html = renderToStaticMarkup(
      <ScenePoster cityName="Portsmouth" campaignTitle="Live Music Revival"
        monthLabel="November 2026" earnedPoints={12} targetPoints={12}
        unlockedMilestones={[25, 50]} archived />,
    );
    expect(html).toContain('Mural revealed: 50%');
    expect(html).toContain('lasting record');
    expect(html).not.toContain('Scene complete');
    expect(html).not.toContain('Make music. Support artists.');
  });
});
