/** Environment-neutral primitives shared by browser gigs and Edge workers. */
export const clampScore = (value: number) => Math.max(0, Math.min(100, value));

const hashSeed = (seed: string) => Array.from(seed).reduce(
  (hash, character) => (Math.imul(31, hash) + character.charCodeAt(0)) | 0,
  2166136261,
) >>> 0;

export const deterministicGigRandom = (seed: string) => (hashSeed(seed) % 10_000) / 10_000;

export interface CanonicalSongScoreInput {
  technicalScore: number;
  performanceScore: number;
  audienceResponse: number;
  seed: string;
  songId: string;
  festivalModifier?: number;
}

/** The sole final song-scoring formula. Festival context is an optional bounded modifier. */
export function calculateCanonicalSongScore(input: CanonicalSongScoreInput) {
  const variance = (deterministicGigRandom(`${input.seed}:${input.songId}:song`) - 0.5) * 8;
  const baseScore = clampScore(
    input.technicalScore * 0.38 + input.performanceScore * 0.39 + input.audienceResponse * 0.23 + variance,
  );
  return {
    baseScore,
    variance,
    score: Math.round(clampScore(baseScore + Math.max(-18, Math.min(18, input.festivalModifier ?? 0)))),
  };
}
