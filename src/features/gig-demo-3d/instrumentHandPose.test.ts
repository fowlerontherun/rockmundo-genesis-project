import { describe, expect, it } from 'vitest';
import * as T from 'three';
import {
  applyInstrumentFingerPose,
  fingerEnvelopeBones,
  handContactPoint,
} from './instrumentHandPose';

function handRig() {
  const root = new T.Group();
  const bones = new Map<string, T.Bone>();

  for (const side of ['L', 'R'] as const) {
    const hand = new T.Bone();
    hand.name = `Hand.${side}`;
    hand.position.set(side === 'L' ? .2 : -.2, 1, 0);
    root.add(hand);
    bones.set(hand.name, hand);

    for (const digit of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'] as const) {
      let parent = hand;
      for (const joint of [1, 2, 3] as const) {
        const bone = new T.Bone();
        bone.name = `${digit}${joint}.${side}`;
        bone.position.set(
          digit === 'Thumb' ? (side === 'L' ? -.018 : .018) : 0,
          .026,
          .018 + joint * .004,
        );
        parent.add(bone);
        parent = bone;
        bones.set(bone.name, bone);
      }
    }
  }
  root.updateMatrixWorld(true);
  return { root, bones };
}

describe('instrument hand poses', () => {
  it('uses the full finger chain for guitar fretting and a pinched picking hand', () => {
    const { bones } = handRig();

    applyInstrumentFingerPose(bones, {
      family: 'strum',
      role: 'guitar',
      instrumentId: 'electric_guitar',
      seconds: 1.1,
      energy: .9,
      reduced: false,
      phase: .2,
    });

    expect(Math.abs(bones.get('Index1.L')!.rotation.x)).toBeGreaterThan(.2);
    expect(Math.abs(bones.get('Index2.L')!.rotation.x)).toBeGreaterThan(.3);
    expect(Math.abs(bones.get('Index3.L')!.rotation.x)).toBeGreaterThan(.4);
    expect(Math.abs(bones.get('Pinky1.L')!.rotation.z)).toBeGreaterThan(0);
    expect(Math.abs(bones.get('Thumb1.R')!.rotation.z)).toBeGreaterThan(0);
    expect(bones.get('Index2.R')!.rotation.x).toBeGreaterThan(bones.get('Ring2.R')!.rotation.x);
  });

  it('alternates index and middle finger emphasis for bass plucking', () => {
    const first = handRig().bones;
    const second = handRig().bones;

    applyInstrumentFingerPose(first, {
      family: 'strum',
      role: 'bass',
      instrumentId: 'bass_guitar',
      seconds: .15,
      energy: 1,
      reduced: false,
    });
    applyInstrumentFingerPose(second, {
      family: 'strum',
      role: 'bass',
      instrumentId: 'bass_guitar',
      seconds: .4,
      energy: 1,
      reduced: false,
    });

    const firstDelta = first.get('Index2.R')!.rotation.x - first.get('Middle2.R')!.rotation.x;
    const secondDelta = second.get('Index2.R')!.rotation.x - second.get('Middle2.R')!.rotation.x;
    expect(firstDelta * secondDelta).toBeLessThan(0);
  });

  it('uses finger contact points instead of only the wrist centre', () => {
    const { root, bones } = handRig();
    root.updateMatrixWorld(true);
    const hand = bones.get('Hand.R')!.getWorldPosition(new T.Vector3());
    const contact = handContactPoint(bones, 'R', ['Thumb', 'Index'])!;

    expect(contact.distanceTo(hand)).toBeGreaterThan(.02);
    expect(fingerEnvelopeBones(bones, 'R')).toHaveLength(16);
  });
});
