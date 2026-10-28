import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { isScenePulse, ScenePulse } from './ScenePulse';

const cityId = '489f99fb-1b10-47b7-b620-cedfd970db10';
const valid = {
  city_id: cityId,
  cadence: 'weekly',
  entries: [
    { day_utc: '2026-10-28', kind: 'activity', action_type: 'gig:verified_performance', actions: 3, milestone_percent: null },
    { day_utc: '2026-10-28', kind: 'milestone', action_type: null, actions: null, milestone_percent: 25 },
  ],
};

describe('City Scene community pulse', () => {
  it('accepts anonymous activity groups and valid server-confirmed milestones', () => {
    expect(isScenePulse(valid, cityId, 'weekly')).toBe(true);
    expect(isScenePulse({ ...valid, entries: [] }, cityId, 'weekly')).toBe(true);
  });

  it('rejects small groups, invalid milestone thresholds and unreviewed source types', () => {
    const activity = valid.entries[0];
    const replace = (patch: Record<string, unknown>) => ({
      ...valid, entries: [{ ...activity, ...patch }],
    });
    expect(isScenePulse(replace({ actions: 2 }), cityId, 'weekly')).toBe(false);
    expect(isScenePulse(replace({ actions: -1 }), cityId, 'weekly')).toBe(false);
    expect(isScenePulse(replace({ action_type: 'social:invite' }), cityId, 'weekly')).toBe(false);
    expect(isScenePulse({ ...valid, entries: [
      { ...valid.entries[1], milestone_percent: 30 },
    ] }, cityId, 'weekly')).toBe(false);
  });

  it('rejects wrong-city, wrong-cadence, invalid date and excessive responses', () => {
    expect(isScenePulse(valid, '8d9a9bfc-572d-428b-9b5b-f000339e6634', 'weekly')).toBe(false);
    expect(isScenePulse(valid, cityId, 'daily')).toBe(false);
    expect(isScenePulse({ ...valid, entries: Array(21).fill(valid.entries[0]) }, cityId, 'weekly')).toBe(false);
    expect(isScenePulse({ ...valid, entries: [{ ...valid.entries[0], day_utc: 'invalid' }] }, cityId, 'weekly')).toBe(false);
  });

  it('uses a neutral loading state before receiving verified server data', () => {
    const html = renderToStaticMarkup(<ScenePulse cityId={cityId} cadence="weekly" refresh={0} />);
    expect(html).toContain('Checking verified scene updates');
    expect(html).not.toContain('XP awarded');
    expect(html).not.toContain('Player ');
  });
});
