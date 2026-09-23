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

  for (const side of ['L', 'R'] as const) {
    const upper = new T.Bone(); upper.name = `UpperArm.${side}`; upper.position.set(side === 'L' ? .18 : -.18, .28, 0);
    const lower = new T.Bone(); lower.name = `LowerArm.${side}`; lower.position.set(side === 'L' ? .24 : -.24, -.05, 0);
    const hand = new T.Bone(); hand.name = `Hand.${side}`; hand.position.set(side === 'L' ? .22 : -.22, -.02, .02);
    torso.add(upper); upper.add(lower); lower.add(hand);
  }
  root.add(hips);

  const mesh = new T.Mesh(
    new T.BoxGeometry(.6, 1.8, .38),
    new T.MeshStandardMaterial({ color: '#888' }),
  );
  mesh.position.y = .9;
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
    expect(report!.valid).toBe(true);
  });

  it('does not invent a grip result for the backstage A-pose', () => {
    const actor = new Musician(simpleRiggedModel(), 'other', [0, 0, 0]);
    expect(inspectAvatarV2Performance(actor, 'backstage')).toBeNull();
  });
});
