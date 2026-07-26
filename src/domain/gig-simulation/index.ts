/** Environment-neutral canonical gig engine shared by browser gigs and workers. */
export const clampScore = (value: number) => Math.max(0, Math.min(100, value));

const hashSeed = (seed: string) => Array.from(seed).reduce(
  (hash, character) => (Math.imul(31, hash) + character.charCodeAt(0)) | 0,
  2166136261,
) >>> 0;

export const deterministicGigRandom = (seed: string) => (hashSeed(seed) % 10_000) / 10_000;

export interface CanonicalGigContext {
  equipmentReliability?: number; crewEffectiveness?: number; venueEffect?: number;
  stageEffect?: number; production?: number; setlistPosition?: number; stamina?: number;
  momentum?: number; crowdState?: number;
}

export interface CanonicalSongCalculationInput extends CanonicalGigContext {
  quality: number; popularity: number; familiarity: number; rehearsalLevel: number;
  performerSkill: number; stagePresence: number; readinessScore: number;
  seed: string; songId: string; festivalModifier?: number;
}

/** Complete, pure calculation. Optional context is neutral at 50 for historical compatibility. */
export function calculateCanonicalSongOutcome(input: CanonicalSongCalculationInput) {
  const equipmentReliability = clampScore(input.equipmentReliability ?? 50);
  const crewEffectiveness = clampScore(input.crewEffectiveness ?? 50);
  const readiness = clampScore(input.readinessScore * .55 + input.rehearsalLevel * .45);
  const songFamiliarity = clampScore(input.familiarity * .7 + input.rehearsalLevel * .3);
  const venueAndStageEffect = ((input.venueEffect ?? 50) - 50) * .04 + ((input.stageEffect ?? 50) - 50) * .04;
  const production = ((input.production ?? 50) - 50) * .06;
  const setlistPosition = ((input.setlistPosition ?? 50) - 50) * .025;
  const stamina = ((input.stamina ?? 50) - 50) * .035;
  const momentum = ((input.momentum ?? 50) - 50) * .035;
  const crowdState = clampScore(input.crowdState ?? 50);
  const technicalScore = clampScore(input.quality * .28 + songFamiliarity * .2 + input.rehearsalLevel * .17 +
    input.performerSkill * .2 + readiness * .15 + (equipmentReliability - 50) * .04 + (crewEffectiveness - 50) * .03);
  const performanceScore = clampScore(input.popularity * .35 + input.stagePresence * .35 + readiness * .3 +
    production + setlistPosition + stamina + momentum);
  const audienceResponse = clampScore(performanceScore * .55 + technicalScore * .3 + input.popularity * .15 +
    (crowdState - 50) * .04 + venueAndStageEffect);
  const variance = (deterministicGigRandom(`${input.seed}:${input.songId}:song`) - .5) * 8;
  const baseScore = clampScore(technicalScore * .38 + performanceScore * .39 + audienceResponse * .23 + variance);
  const documentedModifier = Math.max(-18, Math.min(18, input.festivalModifier ?? 0));
  return { technicalScore, performanceScore, audienceResponse, equipmentReliability, crewEffectiveness,
    readiness, songFamiliarity, venueAndStageEffect, production, setlistPosition, stamina, momentum,
    crowdState, variance, baseScore, documentedModifier, score: Math.round(clampScore(baseScore + documentedModifier)) };
}

export interface CanonicalSongScoreInput { technicalScore: number; performanceScore: number; audienceResponse: number; seed: string; songId: string; festivalModifier?: number }

/** Compatibility boundary for stored normal-gig inputs. */
export function calculateCanonicalSongScore(input: CanonicalSongScoreInput) {
  const variance = (deterministicGigRandom(`${input.seed}:${input.songId}:song`) - .5) * 8;
  const baseScore = clampScore(input.technicalScore * .38 + input.performanceScore * .39 + input.audienceResponse * .23 + variance);
  return { baseScore, variance, score: Math.round(clampScore(baseScore + Math.max(-18, Math.min(18, input.festivalModifier ?? 0)))) };
}
