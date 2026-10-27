import { describe, expect, it } from 'vitest';
import { allocateSceneTarget, getConfirmedScenePosterStage, getSceneCycleBounds, getScenePosterStage, getSceneTarget } from './sceneRules';

describe('City Scene Challenge cycle boundaries', () => {
  it('uses UTC and half-open day ranges across daylight saving changes', () => {
    expect(getSceneCycleBounds('daily', new Date('2026-10-25T01:30:00Z'))).toEqual({
      startsAt: '2026-10-25T00:00:00.000Z',
      endsAt: '2026-10-26T00:00:00.000Z',
    });
  });

  it('starts weekly cycles on Monday even when input is Sunday', () => {
    expect(getSceneCycleBounds('weekly', new Date('2026-10-25T23:59:59Z'))).toEqual({
      startsAt: '2026-10-19T00:00:00.000Z',
      endsAt: '2026-10-26T00:00:00.000Z',
    });
  });

  it('handles month and year rollover correctly', () => {
    expect(getSceneCycleBounds('monthly', new Date('2026-12-31T23:59:59Z'))).toEqual({
      startsAt: '2026-12-01T00:00:00.000Z',
      endsAt: '2027-01-01T00:00:00.000Z',
    });
  });

  it('rejects invalid timestamps', () => {
    expect(() => getSceneCycleBounds('daily', new Date('invalid'))).toThrow(RangeError);
  });
});

describe('City Scene Challenge scaling and mural milestones', () => {
  it('keeps smaller scenes playable without zero targets', () => {
    expect(getSceneTarget('daily', 0)).toBe(3);
    expect(getSceneTarget('weekly', 1)).toBe(3);
    expect(getSceneTarget('monthly', 1)).toBe(3);
    expect(getSceneTarget('daily', 10)).toBe(3);
  });

  it('never requires more city points than participating accounts could earn', () => {
    const caps = { daily: 5, weekly: 10, monthly: 25 } as const;
    for (const activeAccounts of [0, 1, 2, 3, 10, 100]) {
      const capAccounts = Math.max(1, activeAccounts);
      for (const cadence of ['daily', 'weekly', 'monthly'] as const) {
        const target = getSceneTarget(cadence, activeAccounts);
        expect(target).toBeGreaterThanOrEqual(cadence === 'monthly' ? 1 : 3);
        expect(target).toBeLessThanOrEqual(capAccounts * caps[cadence]);
      }
    }
    expect(getSceneTarget('monthly', 100)).toBe(75);
    expect(getSceneTarget('weekly', 100)).toBe(39);
    expect(getSceneTarget('daily', 19)).toBe(3);
    expect(getSceneTarget('weekly', 19)).toBe(9);
    expect(getSceneTarget('monthly', 19)).toBe(15);
  });

  it('allocates all target points with stable tie-breaking', () => {
    expect(allocateSceneTarget(5, [1, 1, 1])).toEqual([2, 2, 1]);
    expect(allocateSceneTarget(20, [2, 1, 1]).reduce((sum, n) => sum + n, 0)).toBe(20);
    expect(() => allocateSceneTarget(2, [1, 1, 1])).toThrow(RangeError);
  });

  it('waits for confirmed server milestones before revealing artwork', () => {
    expect(getConfirmedScenePosterStage([], 100, 100)).toBe(0);
    expect(getConfirmedScenePosterStage([25], 90, 100)).toBe(25);
    expect(getConfirmedScenePosterStage([25, 50], 90, 100)).toBe(50);
    expect(getConfirmedScenePosterStage([25, 50, 75, 100], 100, 100)).toBe(100);
    expect(getConfirmedScenePosterStage([42, -1], 100, 100)).toBe(0);
    expect(getConfirmedScenePosterStage(undefined, 90, 100)).toBe(75);
  });

  it('reveals exactly the earned mural stage without optimistic completion', () => {
    expect([0, 24, 25, 49, 50, 74, 75, 99, 100].map((n) => getScenePosterStage(n, 100)))
      .toEqual([0, 0, 25, 25, 50, 50, 75, 75, 100]);
    expect(getScenePosterStage(0, 0)).toBe(0);
  });
});
