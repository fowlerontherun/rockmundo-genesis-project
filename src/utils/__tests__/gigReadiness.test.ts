import { describe, expect, it } from 'vitest';
import { calculateGigReadiness, ratingForReadiness } from '../gigReadiness';
import { validateGigSetlist } from '../gigSetlistValidation';

const songs = [{ id: 's1', durationSeconds: 1800, rehearsalLevel: 90 }, { id: 's2', durationSeconds: 1800, rehearsalLevel: 80 }];

describe('gig preparation setlist validation', () => {
  it('creates valid setlists and warns on duration mismatch', () => {
    const result = validateGigSetlist([{ songId: 's1', bandId: 'b1', durationSeconds: 180 }], 'b1', 3600);
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('Set duration is shorter than the booked performance slot.');
  });
  it('supports adding, reordering, removing and marking encores', () => {
    const draft = [
      { songId: 's1', bandId: 'b1', durationSeconds: 180, isEncore: false },
      { songId: 's2', bandId: 'b1', durationSeconds: 200, isEncore: true },
    ];
    const reordered = [draft[1], draft[0]].map((s, i) => ({ ...s, isEncore: i === 1 }));
    const removed = reordered.slice(0, 1);
    expect(validateGigSetlist(removed, 'b1', 180).valid).toBe(true);
  });
  it('rejects duplicate songs, songs from another band, missing durations and misplaced encores', () => {
    const result = validateGigSetlist([
      { songId: 's1', bandId: 'b1', durationSeconds: 180, isEncore: true },
      { songId: 's1', bandId: 'b2', durationSeconds: null, isEncore: false },
    ], 'b1');
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'Duplicate songs are not allowed in the same setlist.',
      'Setlist songs must belong to the performing band.',
      'Every setlist song needs an estimated duration.',
      'Encore songs must appear after the normal set.',
    ]));
  });
});

describe('gig readiness', () => {
  it('keeps score between 0 and 100 and applies rating thresholds', () => {
    expect(calculateGigReadiness({ setlistSongs: songs, slotDurationSeconds: 3600 }).score).toBeGreaterThanOrEqual(0);
    expect(calculateGigReadiness({ setlistSongs: songs, slotDurationSeconds: 3600 }).score).toBeLessThanOrEqual(100);
    expect(ratingForReadiness(29)).toBe('poor');
    expect(ratingForReadiness(30)).toBe('average');
    expect(ratingForReadiness(50)).toBe('good');
    expect(ratingForReadiness(70)).toBe('excellent');
    expect(ratingForReadiness(90)).toBe('legendary');
  });
  it('penalizes empty setlists and missing performers', () => {
    const result = calculateGigReadiness({ setlistSongs: [], requiredPerformers: 4, assignedPerformers: 2 });
    expect(result.score).toBeLessThan(50);
    expect(result.blockingIssues.length).toBeGreaterThan(0);
  });
  it('rewards well rehearsed valid setlists and handles missing optional data', () => {
    const result = calculateGigReadiness({ setlistSongs: songs, slotDurationSeconds: 3600, recentRehearsalDaysAgo: 1, recentJamDaysAgo: 1, bandChemistry: 90, fatigueScore: 90, healthScore: 95, requiredPerformers: 4, assignedPerformers: 4 });
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.rating).toMatch(/excellent|legendary/);
  });
  it('reduces readiness for fatigue', () => {
    const fresh = calculateGigReadiness({ setlistSongs: songs, fatigueScore: 95, healthScore: 95 });
    const tired = calculateGigReadiness({ setlistSongs: songs, fatigueScore: 10, healthScore: 20 });
    expect(tired.score).toBeLessThan(fresh.score);
  });
});
