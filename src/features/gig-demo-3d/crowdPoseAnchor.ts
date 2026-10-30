import * as T from 'three';

export type CrowdPoseAnchors = Record<'idle' | 'raised' | 'clapOpen' | 'clapClosed' | 'danceLeft' | 'danceRight' | 'runLeft' | 'runRight', T.Vector3>;

/** Mirror crowdPose in crowdAnimation's shader for props attached to a baked hand.
 * Sample the packed Float32 values, so CPU props and GPU hands use the same phase,
 * blend and quantized previous intensity. Never modifies the baked anchors. */
export function crowdPoseAnchor(poses: CrowdPoseAnchors, mode: number, phase: number, amount: number): T.Vector3 {
  const mix = (a: T.Vector3, b: T.Vector3, t: number) => a.clone().lerp(b, t);
  const { idle, raised, clapOpen, clapClosed, danceLeft, danceRight, runLeft, runRight } = poses;
  switch (mode) {
    case 1: return mix(idle, mix(danceLeft, danceRight, .5 + .5 * Math.sin(phase * 1.7)), amount);
    case 2: return mix(idle, raised, (.86 + .14 * Math.sin(phase * 2.1)) * amount);
    case 3: return mix(idle, mix(clapOpen, clapClosed, .5 + .5 * Math.cos(phase * 12.5663706)), amount);
    case 4: case 5: return mix(idle, raised, amount);
    case 6: return mix(idle, mix(danceRight, raised, .75 + .25 * Math.sin(phase * 5.4)), amount);
    case 7: return mix(idle, mix(danceLeft, danceRight, .5 + .5 * Math.sin(phase * 4)), amount);
    case 8: return mix(idle, mix(runLeft, runRight, .5 + .5 * Math.sin(phase * 7.2)), amount);
    case 9: return mix(idle, mix(danceLeft, danceRight, .5 + .5 * Math.sin(phase * 1.6)), .35 * amount);
    default: {
      const upper = T.MathUtils.smoothstep(idle.y, .8, 1.6) * amount;
      return idle.clone().add(new T.Vector3(Math.sin(phase * .65) * .007 * upper, 0, Math.sin(phase * .43) * .009 * upper));
    }
  }
}

export function blendedCrowdHand(poses: CrowdPoseAnchors, packedMode: number, packedPhase: number, pace: number, amount: number, seconds: number) {
  const mode = Math.floor(packedMode % 16), previous = Math.floor(packedMode / 16);
  const blend = (packedMode % 1) * 2;
  const phase = seconds * pace + packedPhase % 16;
  return crowdPoseAnchor(poses, previous, phase, Math.floor(packedPhase / 16) / 255)
    .lerp(crowdPoseAnchor(poses, mode, phase, amount), blend);
}
