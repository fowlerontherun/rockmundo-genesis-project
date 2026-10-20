import { describe, expect, it } from 'vitest';
import {
  gigSetlistDurationSeconds, gigPositionIsDue, gigCompletionIsDue,
} from '../../../../supabase/functions/_shared/gig-execution-timing';

const items = [
  { songs: { duration_seconds: 90 }, performance_items_catalog: null },
  { songs: null, performance_items_catalog: { duration_seconds: 30 } },
  { songs: { duration_seconds: null }, performance_items_catalog: null },
];
const start = '2026-10-20T12:00:00.000Z';
const startMs = Date.parse(start);

describe('authoritative live gig clock', () => {
  it('uses the same length fallback for songs and non-song performance items', () => {
    expect(gigSetlistDurationSeconds(items)).toBe(300);
    expect(gigSetlistDurationSeconds(items, 2)).toBe(120);
  });
  it('refuses early processing of later setlist positions and forged indices', () => {
    expect(gigPositionIsDue(start, items, 0, startMs)).toBe(true);
    expect(gigPositionIsDue(start, items, 1, startMs + 89_999)).toBe(false);
    expect(gigPositionIsDue(start, items, 1, startMs + 90_000)).toBe(true);
    expect(gigPositionIsDue(start, items, 2, startMs + 119_999)).toBe(false);
    expect(gigPositionIsDue(start, items, 2, startMs + 120_000)).toBe(true);
    expect(gigPositionIsDue(start, items, 3, startMs + 500_000)).toBe(false);
    expect(gigPositionIsDue(start, items, -1, startMs)).toBe(false);
    expect(gigPositionIsDue('', items, 0, startMs)).toBe(false);
  });
  it('does not complete the show before its entire setlist has elapsed', () => {
    expect(gigCompletionIsDue(start, items, startMs + 299_999)).toBe(false);
    expect(gigCompletionIsDue(start, items, startMs + 300_000)).toBe(true);
    expect(gigCompletionIsDue(start, [], startMs + 300_000)).toBe(false);
    expect(gigCompletionIsDue(null, items, startMs + 300_000)).toBe(false);
  });
});
