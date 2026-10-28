import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { activeSceneNewsCycles, isSceneNewsBoard } from './CitySceneNews';

const city = '20000000-0000-0000-0000-000000000071';
const cycle = {
  id: '30000000-0000-0000-0000-000000000071',
  cadence: 'weekly',
  starts_at: '2026-10-26T00:00:00Z',
  ends_at: '2026-11-02T00:00:00Z',
  target_total: 12,
  earned_points: 7,
  milestones: [25, 50],
};
const board = { city_id: city, city_name: 'Portsmouth', cycles: [cycle] };

describe("Today's News City Music Scene bulletin", () => {
  it('accepts only a matching city and valid server-authored totals', () => {
    expect(isSceneNewsBoard(board, city)).toBe(true);
    expect(isSceneNewsBoard(board, '00000000-0000-0000-0000-000000000001')).toBe(false);
    expect(isSceneNewsBoard({ ...board, cycles: [{ ...cycle, earned_points: -1 }] }, city)).toBe(false);
    expect(isSceneNewsBoard({ ...board, cycles: [{ ...cycle, earned_points: NaN }] }, city)).toBe(false);
    expect(isSceneNewsBoard({ ...board, cycles: [{ ...cycle, milestones: [90] }] }, city)).toBe(false);
    expect(isSceneNewsBoard({ ...board, cycles: [{ ...cycle, ends_at: 'not-a-date' }] }, city)).toBe(false);
    expect(isSceneNewsBoard({ ...board, cycles: [{}] }, city)).toBe(false);
  });

  it('does not report expired or future cycles as active', () => {
    if (!isSceneNewsBoard(board, city)) throw new Error('Unexpected invalid fixture');
    expect(activeSceneNewsCycles(board, Date.parse('2026-10-28T12:00:00Z'))).toHaveLength(1);
    expect(activeSceneNewsCycles(board, Date.parse('2026-11-02T00:00:00Z'))).toHaveLength(0);
    expect(activeSceneNewsCycles(board, Date.parse('2026-10-25T23:59:59Z'))).toHaveLength(0);
  });

  it('shows only confirmed city-aggregate board and privacy-filtered Pulse on the news page', () => {
    const news = readFileSync(resolve(process.cwd(), 'src/pages/TodaysNews.tsx'), 'utf8');
    const bulletin = readFileSync(resolve(process.cwd(), 'src/components/news/CitySceneNews.tsx'), 'utf8');
    expect(news).toContain('<CitySceneNews />');
    expect(bulletin).toContain("profile?.current_city_id ?? null");
    expect(bulletin).toContain("rpc('get_city_scene_board'");
    expect(bulletin).toContain("rpc('get_city_scene_pulse'");
    expect(bulletin).toContain("isScenePulse(data, cityId!, 'weekly')");
    expect(bulletin).toContain('at least three different accounts');
    expect(bulletin).toContain('Community highlights are temporarily unavailable.');
    for (const unsafe of ['scene_contributions', 'source_event_id', 'get_my_city_scene_activity', "rpc('claim_scene_reward'"]) {
      expect(bulletin).not.toContain(unsafe);
    }
  });
});
