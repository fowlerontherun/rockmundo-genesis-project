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
