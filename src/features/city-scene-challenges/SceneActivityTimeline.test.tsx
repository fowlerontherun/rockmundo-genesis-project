import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SceneActivityTimeline, isSceneActivityCredits } from './SceneActivityTimeline';

const sample = {
  cycle_id: '3b97840f-818d-4e80-a26b-3d221ee1ad43',
  cadence: 'weekly' as const,
  action_type: 'gig:verified_performance',
  points: 2,
  completed_at: '2026-10-27T15:00:00Z',
};

describe('City Scene private activity history', () => {
  it('rejects invalid, negative or malformed server responses', () => {
    expect(isSceneActivityCredits([sample])).toBe(true);
    expect(isSceneActivityCredits([{ ...sample, points: -1 }])).toBe(false);
    expect(isSceneActivityCredits([{ ...sample, points: 7 }])).toBe(false);
    expect(isSceneActivityCredits([{ ...sample, completed_at: 'bad-date' }])).toBe(false);
    expect(isSceneActivityCredits([{ ...sample, cadence: 'yearly' }])).toBe(false);
    expect(isSceneActivityCredits({ account_id: 'another-user', credits: [] })).toBe(false);
  });

  it('shows unavailable history as unavailable, not zero or completed rewards', () => {
    const html = renderToStaticMarkup(<SceneActivityTimeline credits={null} />);
    expect(html).toContain('temporarily unavailable');
    expect(html).not.toContain('No verified scene credits yet');
    expect(html).not.toContain('XP earned');
  });

  it('distinguishes an empty verified activity history from a failed request', () => {
    const html = renderToStaticMarkup(<SceneActivityTimeline credits={[]} />);
    expect(html).toContain('No verified scene credits yet');
    expect(html).toContain('after the server verifies completion');
  });

  it('shows cadence-specific verified credits and makes overlapping counts explicit', () => {
    const html = renderToStaticMarkup(
      <SceneActivityTimeline credits={[sample, { ...sample, cadence: 'daily', points: 2 }]} />,
    );
    expect(html).toContain('Completed live performance');
    expect(html).toContain('weekly');
    expect(html).toContain('daily');
    expect(html).toContain('+2 SP');
    expect(html).toContain('One verified activity may help multiple');
    expect(html).toContain('not spendable currency or XP');
    expect(html).not.toContain('source_event_id');
    expect(html).not.toContain('account_id');
  });
});
