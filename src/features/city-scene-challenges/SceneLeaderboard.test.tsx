import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SceneLeaderboard, isSceneLeaderboard } from './SceneLeaderboard';

const city = 'b2a47b49-2a85-4f7d-a284-74301c7e5039';
const response = {
  city_id: city,
  cadence: 'weekly',
  my_opted_in: false,
  entries: [
    { rank: 1, display_name: 'Local Supporter', points: 4, verified_actions: 2, is_me: false },
    { rank: 2, display_name: 'Studio Hero', points: 2, verified_actions: 1, is_me: false },
  ],
};

describe('Scene Supporters leaderboard', () => {
  it('accepts only validated server-owned ranked results', () => {
    expect(isSceneLeaderboard(response, city, 'weekly')).toBe(true);
    expect(isSceneLeaderboard({ ...response, entries: [] }, city, 'weekly')).toBe(true);
    expect(isSceneLeaderboard(response, city, 'daily')).toBe(false);
    expect(isSceneLeaderboard({ ...response, entries: [
      { ...response.entries[0], rank: 3 },
    ] }, city, 'weekly')).toBe(false);
    expect(isSceneLeaderboard({ ...response, entries: [
      { ...response.entries[0], points: -1 },
    ] }, city, 'weekly')).toBe(false);
    expect(isSceneLeaderboard({ ...response, entries: Array(21).fill(response.entries[0]) }, city, 'weekly')).toBe(false);
    expect(isSceneLeaderboard({ ...response, my_opted_in: 'yes' }, city, 'weekly')).toBe(false);
  });

  it('shows a neutral server-loading state, never made-up ranks', () => {
    const html = renderToStaticMarkup(
      <SceneLeaderboard cityId={city} cadence="weekly" refresh={0} />,
    );
    expect(html).toContain('Loading consenting contributors');
    expect(html).toContain('choose to appear');
    expect(html).not.toContain('Local Supporter');
    expect(html).not.toContain('XP earned');
  });
});
