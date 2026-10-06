import type { CameraShot } from './config';
import type { PerformanceSection } from './liveTypes';
import type { Point3, PerformerCameraPose } from './venueCameraAngles';
import type { TotpStudioStageGeometry } from './totpStudioGeometry';
import { smoothMotion } from './performanceMotion';

export const TV_PERFORMANCE_SHOTS = [
  'tv_crane', 'tv_lead_close', 'tv_instrument_left', 'tv_tracking',
  'tv_drummer_close', 'tv_band_two', 'tv_instrument_right', 'tv_orbit',
  'tv_low_angle', 'tv_push_in', 'tv_overhead', 'tv_pull_back',
] as const satisfies readonly CameraShot[];

/** Pure cue-local camera paths; no accumulated frame state. */
export function frameTvPerformance(shot: CameraShot, geometry: TotpStudioStageGeometry,
  subject: Point3, progress: number, aspect: number, reduced = false): PerformerCameraPose | null {
  if (!TV_PERFORMANCE_SHOTS.some(value => value === shot) && shot !== 'tv_lead_medium') return null;
  const u = reduced ? .5 : smoothMotion(Number.isFinite(progress) ? progress : 0);
  const pan = u * 2 - 1;
  const safeAspect = Number.isFinite(aspect) ? Math.max(.55, Math.min(2.5, aspect)) : 1;
  const phone = 1 / Math.min(1, safeAspect);
  const centre: Point3 = [geometry.centerX, geometry.floorY + 1.2, geometry.centerZ];
  let target: Point3 = [subject[0], subject[1] + 1.42, subject[2]];
  let offset: Point3 = [.72 + pan * .09, .28, 2.95 * phone];
  let fov = 34;
  switch (shot) {
    case 'tv_lead_medium': offset = [-1.1 + pan * .25, .45, 3.8 * phone]; fov = 39; break;
    case 'tv_instrument_left': case 'tv_instrument_right':
      target = [subject[0], subject[1] + 1.15, subject[2]];
      offset = [(shot === 'tv_instrument_left' ? -1 : 1) * (1.3 + pan * .2), .4, 3.05 * phone]; break;
    case 'tv_drummer_close':
      target = [subject[0], subject[1] + 1.12, subject[2]];
      offset = [1.65 + pan * .18, 1.05, 3.1 * phone]; fov = 38; break;
    case 'tv_push_in': offset = [.2, .32, (4.2 - u * 1.05) * phone]; break;
    case 'tv_orbit': {
      const angle = pan * .32;
      offset = [Math.sin(angle) * 3.8, .42, Math.cos(angle) * 3.8 * phone]; fov = 39; break;
    }
    case 'tv_band_two': target = centre; offset = [1.1 + pan * .5, .6, Math.max(4.6, geometry.safeWidth * .95) * phone]; fov = 46; break;
    case 'tv_tracking': target = centre; offset = [-2.6 + u * 2.6, .55, 5.4 * phone]; fov = 46; break;
    case 'tv_low_angle': offset = [.4 + pan * .35, -.75, 3.8 * phone]; fov = 44; break;
    case 'tv_crane': target = centre; offset = [2.6 - u * 2.6, 4.1 - u, 6.4 * phone]; fov = 50; break;
    case 'tv_overhead': target = centre; offset = [pan * .4, 6.6, 1.5 * phone]; fov = 48; break;
    case 'tv_pull_back': target = centre; offset = [.3 + pan * .3, 1.1 + u * .6, (5.2 + u * 1.8) * phone]; fov = 48; break;
  }
  return { target, position: [target[0] + offset[0], target[1] + offset[1], target[2] + offset[2]], fov };
}

/** Small rhythmic steps stay within the authoritative studio pocket. */
export function studioPerformerMotion(base: Point3, geometry: TotpStudioStageGeometry, seconds: number,
  phase: number, energy: number, section: PerformanceSection, anchored: boolean, reduced: boolean) {
  if (anchored || reduced || section === 'release' || section === 'idle') return { dx: 0, dz: 0, yaw: 0 };
  const t = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const e = Number.isFinite(energy) ? Math.max(0, Math.min(1, energy)) : 0;
  const strength = (section === 'chorus' || section === 'outro' ? 1 : .55) * e;
  const dx = Math.sin(t * .72 + phase) * .16 * strength;
  const dz = Math.sin(t * .48 + phase * 1.7) * .12 * strength;
  const clampAxis = (origin: number, delta: number, centre: number, width: number) => {
    const min = centre - width / 2, max = centre + width / 2;
    if (origin < min || origin > max) return 0;
    return Math.max(min, Math.min(max, origin + delta)) - origin;
  };
  return { dx: clampAxis(base[0], dx, geometry.centerX, geometry.safeWidth),
    dz: clampAxis(base[2], dz, geometry.centerZ, geometry.safeDepth),
    yaw: Math.sin(t * .6 + phase) * .09 * strength };
}
