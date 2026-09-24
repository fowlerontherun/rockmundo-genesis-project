import * as T from 'three';
import type { PlayingStyle } from './instrumentCatalog';
import type { StageRole } from './liveTypes';

export type HandSide = 'L' | 'R';
export type FingerDigit = 'Thumb' | 'Index' | 'Middle' | 'Ring' | 'Pinky';

const FINGERS: FingerDigit[] = ['Index', 'Middle', 'Ring', 'Pinky'];
const JOINT_SCALE = [0, .62, .86, 1] as const;

function bone(
  bones: Map<string, T.Bone>,
  digit: FingerDigit,
  joint: 1 | 2 | 3,
  side: HandSide,
) {
  return bones.get(`${digit}${joint}.${side}`);
}

function rotateFinger(
  bones: Map<string, T.Bone>,
  digit: FingerDigit,
  side: HandSide,
  curl: number,
  splay = 0,
  twist = 0,
) {
  for (const joint of [1, 2, 3] as const) {
    const target = bone(bones, digit, joint, side);
    if (!target) continue;
    target.rotateX(curl * JOINT_SCALE[joint]);
    if (joint === 1) {
      target.rotateZ(splay);
      target.rotateY(twist);
    }
  }
}

export interface InstrumentFingerPoseOptions {
  family?: PlayingStyle | null;
  role: StageRole;
  instrumentId?: string | null;
  seconds: number;
  energy: number;
  reduced: boolean;
  phase?: number;
}

/**
 * Shapes complete finger chains around the thing being played instead of applying
 * one generic fist curl to every performer. Missing distal joints are ignored so
 * V1 rigs keep their current fallback while V2 can use all authored phalanges.
 */
export function applyInstrumentFingerPose(
  bones: Map<string, T.Bone>,
  options: InstrumentFingerPoseOptions,
) {
  const {
    family,
    role,
    instrumentId = '',
    seconds,
    energy,
    reduced,
    phase = 0,
  } = options;
  const motion = reduced ? 0 : energy;
  const bass = role === 'bass' || instrumentId === 'bass_guitar';
  const chord = Math.floor(Math.max(0, seconds) / (bass ? 1.8 : 2.4)) % 4;
  const chordShapes = [
    { Index: .72, Middle: .62, Ring: .80, Pinky: .52 },
    { Index: .82, Middle: .70, Ring: .58, Pinky: .76 },
    { Index: .66, Middle: .84, Ring: .72, Pinky: .48 },
    { Index: .78, Middle: .58, Ring: .86, Pinky: .70 },
  ] as const;

  for (const side of ['L', 'R'] as const) {
    for (const digit of FINGERS) {
      let curl = role === 'fan' ? .2 : family === 'keys' ? .2 : .46;
      let splay = 0;
      let twist = 0;

      if (family === 'strum' && side === 'L') {
        curl = chordShapes[chord][digit];
        const spread = digit === 'Index' ? -.055 : digit === 'Middle' ? -.018 : digit === 'Ring' ? .024 : .055;
        splay = spread * (side === 'L' ? 1 : -1);
        twist = (digit === 'Index' ? -.025 : digit === 'Pinky' ? .028 : 0);
      } else if (family === 'strum' && side === 'R') {
        if (bass) {
          const alternate = Math.sin(seconds * Math.PI * 4 + phase);
          const indexActive = alternate >= 0;
          curl = digit === 'Index'
            ? (indexActive ? .62 : .34)
            : digit === 'Middle'
              ? (indexActive ? .34 : .64)
              : .24;
        } else {
          curl = digit === 'Index' ? .42 : digit === 'Middle' ? .24 : digit === 'Ring' ? .18 : .14;
          if (digit === 'Index') {
            splay = -.03;
            twist = .025;
          }
        }
      } else if (family === 'kit') {
        curl = digit === 'Index' ? .54 : digit === 'Middle' ? .67 : digit === 'Ring' ? .60 : .52;
        splay = (digit === 'Index' ? -.018 : digit === 'Pinky' ? .025 : 0) * (side === 'L' ? 1 : -1);
      } else if (family === 'voice' && side === 'R') {
        curl = digit === 'Index' ? .64 : digit === 'Middle' ? .72 : digit === 'Ring' ? .75 : .66;
        splay = (digit === 'Index' ? -.02 : digit === 'Pinky' ? .018 : 0) * (side === 'L' ? 1 : -1);
      } else if (family === 'keys') {
        const offset = digit.charCodeAt(0) * .17 + (side === 'L' ? 0 : 1.1);
        curl = .12 + Math.max(0, Math.sin(seconds * 10.5 + offset)) * .22 * motion;
      }

      rotateFinger(bones, digit, side, curl, splay, twist);
    }

    let thumbCurl = .2;
    let thumbSplay = 0;
    let thumbTwist = 0;
    if (family === 'strum') {
      if (side === 'L') {
        thumbCurl = .34;
        thumbSplay = side === 'L' ? -.10 : .10;
      } else if (bass) {
        thumbCurl = .30;
        thumbSplay = .08;
      } else {
        thumbCurl = .50;
        thumbSplay = .13;
        thumbTwist = -.10;
      }
    } else if (family === 'kit') {
      thumbCurl = .45;
      thumbSplay = side === 'L' ? -.09 : .09;
    } else if (family === 'voice' && side === 'R') {
      thumbCurl = .52;
      thumbSplay = .12;
      thumbTwist = -.08;
    }
    rotateFinger(bones, 'Thumb', side, thumbCurl, thumbSplay, thumbTwist);
  }
}

function preferredBone(
  bones: Map<string, T.Bone>,
  side: HandSide,
  digit: FingerDigit,
) {
  return bone(bones, digit, 2, side)
    ?? bone(bones, digit, 1, side)
    ?? bones.get(`Hand.${side}`)
    ?? null;
}

export function handContactPoint(
  bones: Map<string, T.Bone>,
  side: HandSide,
  digits: FingerDigit[] = ['Thumb', 'Index'],
) {
  const points = digits
    .map(digit => preferredBone(bones, side, digit))
    .filter((value): value is T.Bone => !!value)
    .map(value => value.getWorldPosition(new T.Vector3()));

  if (!points.length) return null;
  return points
    .reduce((sum, point) => sum.add(point), new T.Vector3())
    .multiplyScalar(1 / points.length);
}

export function fingerEnvelopeBones(
  bones: Map<string, T.Bone>,
  side: HandSide,
) {
  const result: T.Bone[] = [];
  const hand = bones.get(`Hand.${side}`);
  if (hand) result.push(hand);
  for (const digit of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'] as const) {
    for (const joint of [1, 2, 3] as const) {
      const value = bone(bones, digit, joint, side);
      if (value) result.push(value);
    }
  }
  return result;
}
