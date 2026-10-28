import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SceneCycleCountdown, findNextSceneCycleExpiry, formatSceneTimeRemaining } from './SceneCycleCountdown';

const end = '2026-11-01T00:00:00Z';

describe('City Scene real-time UTC cycle countdown', () => {
  it('handles UTC boundaries and readable countdown intervals', () => {
    expect(formatSceneTimeRemaining(end, Date.parse('2026-10-31T23:59:00Z'))).toBe('1m remaining');
    expect(formatSceneTimeRemaining(end, Date.parse('2026-10-31T23:00:00Z'))).toBe('1h 00m remaining');
    expect(formatSceneTimeRemaining(end, Date.parse('2026-10-30T22:00:00Z'))).toBe('1d 2h remaining');
    expect(formatSceneTimeRemaining(end, Date.parse(end))).toBe('Cycle ended');
    expect(formatSceneTimeRemaining(end, Date.parse('2026-11-01T12:00:00Z'))).toBe('Cycle ended');
    expect(formatSceneTimeRemaining('not-a-date', Date.now())).toBe('Deadline unavailable');
  });

  it('chooses the earliest still-unhandled server deadline to trigger exactly one refresh', () => {
    const cycles = [
      { id: 'week', ends_at: '2026-11-02T00:00:00Z' },
      { id: 'daily', ends_at: '2026-10-29T00:00:00Z' },
      { id: 'month', ends_at: '2026-12-01T00:00:00Z' },
      { id: 'bad', ends_at: 'not-a-date' },
    ];
    expect(findNextSceneCycleExpiry(cycles, new Set())?.id).toBe('daily');
    expect(findNextSceneCycleExpiry(cycles, new Set(['daily']))?.id).toBe('week');
    expect(findNextSceneCycleExpiry(cycles, new Set(['daily', 'week', 'month']))).toBeNull();
  });

  it('renders countdown without a false eligibility or reward assertion', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-31T23:59:30Z'));
      const html = renderToStaticMarkup(<SceneCycleCountdown endsAt={end} />);
      expect(html).toContain('1m remaining');
      expect(html).not.toContain('XP');
      expect(html).not.toContain('Reward');
    } finally {
      vi.useRealTimers();
    }
  });
});
