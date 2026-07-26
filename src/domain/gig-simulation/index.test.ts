import { describe, expect, it } from 'vitest';
import { calculateCanonicalSongScore, deterministicGigRandom } from './index';

describe('canonical gig simulation core', () => {
  it('is deterministic and keeps Festival context optional', () => {
    const input = { technicalScore: 72, performanceScore: 81, audienceResponse: 77, seed: 'fixture', songId: 'song-1' };
    expect(calculateCanonicalSongScore(input)).toEqual(calculateCanonicalSongScore(input));
    expect(calculateCanonicalSongScore({ ...input, festivalModifier: 0 })).toEqual(calculateCanonicalSongScore(input));
    expect(deterministicGigRandom('fixture')).toBe(deterministicGigRandom('fixture'));
  });

  it('bounds Festival influence without changing the canonical base result', () => {
    const input = { technicalScore: 72, performanceScore: 81, audienceResponse: 77, seed: 'fixture', songId: 'song-1' };
    const base = calculateCanonicalSongScore(input);
    const festival = calculateCanonicalSongScore({ ...input, festivalModifier: 500 });
    expect(festival.baseScore).toBe(base.baseScore);
    expect(festival.score - base.score).toBeLessThanOrEqual(18);
  });
});
