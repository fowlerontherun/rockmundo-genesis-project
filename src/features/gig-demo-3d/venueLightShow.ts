import type { DemoQuality } from './config';
import type { VenueProfile } from './venueProfile';

export type LightPosition = readonly [number, number, number];

export interface VenueLightingPlan {
  readonly tier: number;
  readonly fixtureCount: number;
  readonly spotlightIndices: readonly number[];
  readonly supplementaryBeamIndices: readonly number[];
  readonly activeBeamCount: number;
  readonly physicalSpotlightCount: number;
  readonly baseBeamCount: number;
}

/**
 * Large venues show many fixtures and volumetric beams, not dozens of expensive
 * WebGL spotlights. Pick each shadow/light source from an actual rendered fixture,
 * then spread the extra haze beams over the remaining rig in fixed order.
 */
export function planVenueLighting(
  profile: VenueProfile | null,
  positions: readonly LightPosition[],
  tier: number,
  quality: DemoQuality,
): VenueLightingPlan {
  if (!profile) return {
    tier: 2, fixtureCount: 8, spotlightIndices: [0, 1, 2, 3, 4, 5, 6, 7],
    supplementaryBeamIndices: [], activeBeamCount: 4,
    physicalSpotlightCount: 8, baseBeamCount: 4,
  };
  const fixtureCount = positions.length;
  const physicalSpotlightCount = Math.min(fixtureCount, 8);
  const spotlightIndices = Array.from({ length: physicalSpotlightCount }, (_, i) =>
    Math.floor(i * fixtureCount / physicalSpotlightCount));
  const baseBeamCount = Math.min(4, physicalSpotlightCount);
  const extrasByTier = [0, 0, 4, 8, 16][Math.min(4, Math.max(0, tier))] ?? 0;
  const spotlightSet = new Set(spotlightIndices);
  const available = Array.from({ length: fixtureCount }, (_, i) => i).filter(i => !spotlightSet.has(i));
  const supplementaryCount = Math.min(extrasByTier, available.length);
  const supplementaryBeamIndices = Array.from({ length: supplementaryCount }, (_, i) =>
    available[Math.floor((i + .5) * available.length / supplementaryCount)]);
  const qualityCount = quality === 'low' ? baseBeamCount : quality === 'balanced' ? 10 : 20;
  return {
    tier, fixtureCount, spotlightIndices, supplementaryBeamIndices,
    activeBeamCount: Math.min(baseBeamCount + supplementaryCount, qualityCount),
    physicalSpotlightCount, baseBeamCount,
  };
}

export interface VenueBeamCue {
  readonly target: LightPosition;
  readonly opacity: number;
}

/** Absolute playback time/seed, never wall-clock delta: rewinding a gig gives
 * the same lamp positions, including after quality and reduced-motion toggles. */
export function venueBeamCue(
  p: VenueProfile,
  source: LightPosition,
  ordinal: number,
  playbackSeconds: number,
  lightLevel: number,
  reducedMotion: boolean,
): VenueBeamCue {
  const t = !reducedMotion && Number.isFinite(playbackSeconds) ? Math.max(0, playbackSeconds) : 0;
  const energy = Number.isFinite(lightLevel) ? Math.max(0, Math.min(1.5, lightLevel)) : 1;
  const phase = t * (.22 + ordinal % 3 * .055) + ordinal * 1.37 + p.seed * .017;
  const swing = Math.sin(phase) * Math.min(3.2, p.stageWidth * .115) * Math.min(1, energy);
  const targetX = Math.max(-p.stageWidth * .41, Math.min(p.stageWidth * .41, source[0] * .55 + swing));
  const targetZ = .65 - p.stageDepth * (.27 + .06 * Math.cos(phase * .7));
  return {
    target: [targetX, p.stageHeight + .24, targetZ],
    opacity: .018 + .034 * Math.min(1, energy),
  };
}
