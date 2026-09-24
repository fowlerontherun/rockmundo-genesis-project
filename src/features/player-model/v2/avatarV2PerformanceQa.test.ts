import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { defaultAppearance } from '../appearance';
import { Musician } from '@/features/gig-demo-3d/performers';
import { inspectAvatarV2Performance } from './avatarV2PerformanceQa';

function simpleRiggedModel() {
  const root = new T.Group();
  root.userData.rockmundoAvatarEngine = 'rockmundo-v2';
  const hips = new T.Bone(); hips.name = 'Hips'; hips.position.y = .9;
  const torso = new T.Bone(); torso.name = 'Spine2'; torso.position.y = .45; hips.add(torso);
  const head = new T.Bone(); head.name = 'Head'; head.position.y = .38; torso.add(head);
  for (const side of ['L', 'R'] as const) {
    const eye = new T.Bone();
    eye.name = `Eye.${side}`;
    eye.position.set(side === 'L' ? .035 : -.035, .04, .08);
    head.add(eye);
  }

  for (const side of ['L', 'R'] as const) {
    const upper = new T.Bone(); upper.name = `UpperArm.${side}`; upper.position.set(side === 'L' ? .18 : -.18, .28, 0);
    const lower = new T.Bone(); lower.name = `LowerArm.${side}`; lower.position.set(side === 'L' ? .24 : -.24, -.05, 0);
    const hand = new T.Bone(); hand.name = `Hand.${side}`; hand.position.set(side === 'L' ? .22 : -.22, -.02, .02);
    torso.add(upper); upper.add(lower); lower.add(hand);
    for (const digit of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'] as const) {
      let parent: T.Bone = hand;
      for (const joint of [1, 2, 3] as const) {
        const finger = new T.Bone();
        finger.name = `${digit}${joint}.${side}`;
        finger.position.set(
          digit === 'Thumb' ? (side === 'L' ? -.018 : .018) : 0,
          .025,
          .018 + joint * .003,
        );
        parent.add(finger);
        parent = finger;
      }
    }
  }
  root.add(hips);

  const mesh = new T.Mesh(
    new T.BoxGeometry(.6, 1.8, .38),
    new T.MeshStandardMaterial({ color: '#888' }),
  );
  mesh.position.y = .9;
  mesh.morphTargetDictionary = {
    blinkLeft: 0,
    blinkRight: 1,
    jawOpen: 2,
    mouthSmile: 3,
  };
  mesh.morphTargetInfluences = Array(4).fill(0);
  root.add(mesh);
  return root;
}

describe('Avatar V2 performance QA', () => {
  it('certifies both guitar hands against the live instrument grip targets', () => {
    const actor = new Musician(
      simpleRiggedModel(),
      'guitar',
      [0, 0, 0],
      0,
      undefined,
      defaultAppearance('v2-guitar-qa'),
      'electric_guitar',
    );

    const report = inspectAvatarV2Performance(actor, 'electric_guitar');
    expect(report).not.toBeNull();
    expect(report!.valid).toBe(true);
    expect(report!.maxLeftGripError).toBeLessThan(.14);
    expect(report!.maxRightGripError).toBeLessThan(.14);
    expect(report!.maxFingerContactError).toBeLessThan(.20);
    expect(report!.eyeBones).toBe(2);
    expect(report!.maxEyeMotion).toBeGreaterThan(.004);
    expect(report!.guitarPicks).toBe(1);
  });

  it('certifies both visible drumsticks and their hand tracking', () => {
    const actor = new Musician(
      simpleRiggedModel(),
      'drums',
      [0, 0, 0],
      0,
      undefined,
      defaultAppearance('v2-drums-qa'),
      'rock_drums',
    );

    const report = inspectAvatarV2Performance(actor, 'rock_drums');
    expect(report).not.toBeNull();
    expect(report!.drumsticks).toBe(2);
    expect(report!.maxDrumstickError).toBeLessThan(.14);
    expect(report!.maxFingerContactError).toBeLessThan(.20);
    expect(report!.eyeBones).toBe(2);
    expect(report!.maxEyeMotion).toBeGreaterThan(.004);
    expect(report!.valid).toBe(true);
  });

  it('does not invent a grip result for the backstage A-pose', () => {
    const actor = new Musician(simpleRiggedModel(), 'other', [0, 0, 0]);
    expect(inspectAvatarV2Performance(actor, 'backstage')).toBeNull();
  });
});
