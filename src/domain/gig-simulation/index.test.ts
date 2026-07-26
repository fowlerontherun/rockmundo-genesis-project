import { describe, expect, it } from 'vitest';
import { calculateCanonicalSongOutcome, calculateCanonicalSongScore, deterministicGigRandom } from './index';

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

  it('calculates every canonical dimension deterministically and confines Festival influence', () => {
    const input = { quality: 70, popularity: 60, familiarity: 80, rehearsalLevel: 75, performerSkill: 70,
      stagePresence: 75, readinessScore: 80, seed: 'fixture', songId: 'song-1' };
    const normal = calculateCanonicalSongOutcome(input);
    const festival = calculateCanonicalSongOutcome({ ...input, festivalModifier: 12 });
    expect(festival).toMatchObject({ technicalScore: normal.technicalScore, performanceScore: normal.performanceScore,
      audienceResponse: normal.audienceResponse, baseScore: normal.baseScore, documentedModifier: 12 });
    expect(calculateCanonicalSongOutcome(input)).toEqual(normal);
  });
});
