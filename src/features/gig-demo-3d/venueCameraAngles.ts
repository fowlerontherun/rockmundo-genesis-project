import type { VenueProfile } from './venueProfile';

export type PerformerCameraAngle = 'bass_close' | 'backline_reverse';
export type Point3 = readonly [number, number, number];

export interface PerformerCameraPose {
  readonly position: Point3;
  readonly target: Point3;
  readonly fov: number;
}

/**
 * Pure world-space framing for regular 3D gigs, not broadcast/TOTP.
 * No frame history or random state, so jumping to the same replay instant
 * preserves exactly the same shot composition across devices.
 */
export function frameVenuePerformer(
  p: VenueProfile,
  angle: PerformerCameraAngle,
  subject: Point3,
  aspect: number,
): PerformerCameraPose {
  const safeAspect = Number.isFinite(aspect) ? Math.max(.55, Math.min(2.5, aspect)) : 1;
  const half = p.stageWidth * .5;
  const x = Math.max(-half + .3, Math.min(half - .3, subject[0]));
  const back = .65 - p.stageDepth;
  if (angle === 'bass_close') {
    const focusHeight = subject[1] + 1.15;
    const distance = Math.max(2.85, 3.35 / Math.min(1, safeAspect));
    return {
      target: [x, focusHeight, subject[2] + .03],
      position: [
        Math.max(-half + .25, Math.min(half - .25, x - 1.35)),
        focusHeight + .32,
        Math.max(back + .45, subject[2] + distance),
      ],
      fov: 37,
    };
  }
  // This lens sits *in front of* the rear LED wall, behind the singer, and
  // looks downstage into the audience. Keep the camera inside the wing lanes,
  // under the roof or truss, and off the drum/camera centreline.
  const shoulderX = Math.max(-half + .45, Math.min(half - .45, x - Math.min(2.35, p.stageWidth * .17)));
  const height = Math.min(p.outdoor ? p.rigHeight - .65 : p.roofHeight - .7, p.stageHeight + 3.15);
  const cameraZ = Math.max(back + p.stageDepth * .37, subject[2] - Math.max(1.5, p.stageDepth * .22));
  return {
    position: [shoulderX, height, cameraZ],
    target: [x, subject[1] + 1.35, Math.max(subject[2] + p.stageDepth * .42, .65 + .15)],
    fov: 54,
  };
}

/** Fit the actual band (including instruments), not the much wider stage deck. */
export function frameVenueBand(p: VenueProfile, subjects: readonly Point3[], aspect: number): PerformerCameraPose {
  const points = subjects.length ? subjects : [[0, p.stageHeight, .65 - p.stageDepth * .45] as Point3];
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const point of points) for (let axis = 0; axis < 3; axis++) {
    min[axis] = Math.min(min[axis], point[axis] + [-1.1, 0, -1.2][axis]);
    max[axis] = Math.max(max[axis], point[axis] + [1.1, 2.2, 1.2][axis]);
  }
  const target: Point3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const safeAspect = Number.isFinite(aspect) ? Math.max(.4, Math.min(3, aspect)) : 1;
  const fov = 43, tanV = Math.tan(fov * Math.PI / 360), tanH = tanV * safeAspect;
  const tilt = .16, sin = Math.sin(tilt), cos = Math.cos(tilt);
  let distance = 5.5;
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
    const dx = x - target[0], dy = y - target[1], dz = z - target[2];
    distance = Math.max(distance, dy * sin + dz * cos + 1.12 * Math.max(Math.abs(dx) / tanH, Math.abs(dy * cos - dz * sin) / tanV));
  }
  return { target, position: [target[0], target[1] + sin * distance, target[2] + cos * distance], fov };
}
