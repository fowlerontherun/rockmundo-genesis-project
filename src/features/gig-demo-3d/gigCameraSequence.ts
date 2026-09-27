import type { CameraShot } from './config';
import type { PerformanceSection } from './liveTypes';

/**
 * Replay-time camera grammar for ordinary 3D gigs. No random state or render
 * frame dependency: seeking to the same timestamp reconstructs the same shot.
 * Larger venues deliberately get a performer close-up within the first 18s
 * and another at least every 36s instead of living on distant crowd wides.
 */
export const GIG_CAMERA_SHOT_SECONDS = 9;

const STANDARD_SHOTS = [
  'front', 'side_pit', 'guitar', 'band_medium', 'drums',
  'lead_close', 'side_stage', 'crane',
] as const satisfies readonly CameraShot[];

const LARGE_VENUE_SHOTS = [
  'front', 'lead_close', 'side_pit', 'guitar', 'crane',
  'lead_close', 'drums', 'band_medium', 'side_stage', 'lead_close',
] as const satisfies readonly CameraShot[];

export function directGigCamera(
  seconds: number,
  section: PerformanceSection | undefined,
  sectionProgress: number | undefined,
  largeVenue: boolean,
  reducedMotion: boolean,
): Exclude<CameraShot, 'director'> {
  if (reducedMotion) return 'front';
  if (section === 'release') return (sectionProgress ?? 0) < .5 ? 'front' : 'stage';
  if (section === 'solo') return 'guitar';

  const sequence = largeVenue ? LARGE_VENUE_SHOTS : STANDARD_SHOTS;
  const timestamp = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return sequence[Math.floor(timestamp / GIG_CAMERA_SHOT_SECONDS) % sequence.length];
}
