import { describe, expect, it } from 'vitest';
import * as T from 'three';
import {
  AVATAR_V2_SHOULDER_MAX_ANGLE,
  createAvatarV2ShoulderController,
} from './avatarV2Shoulder';

function rig() {
  const root = new T.Group();
  root.userData.rockmundoAvatarEngine = 'rockmundo-v2';

  const chest = new T.Bone();
  chest.name = 'Spine2';
  root.add(chest);

  for (const side of ['L', 'R'] as const) {
    const sign = side === 'L' ? 1 : -1;
    const shoulder = new T.Bone();
    shoulder.name = `Shoulder.${side}`;
    shoulder.position.set(sign * .05, .7, 0);
    chest.add(shoulder);

    const upper = new T.Bone();
    upper.name = `UpperArm.${side}`;
    upper.position.set(sign * .18, -.02, 0);
    shoulder.add(upper);
  }

  root.updateMatrixWorld(true);
  return root;
}

describe('Avatar V2 shoulder girdle follow', () => {
  it('moves the clavicle toward a raised hand target without exceeding the deformation bound', () => {
    const root = rig();
    const controller = createAvatarV2ShoulderController(root);
    expect(controller).not.toBeNull();
    expect(root.userData.rockmundoAvatarV2ShoulderGirdle).toEqual({ active: 2, required: 2 });

    controller!.aim('L', new T.Vector3(.55, 1.45, .35));

    const shoulder = root.getObjectByName('Shoulder.L') as T.Bone;
    const motion = Number(shoulder.userData.rockmundoAvatarV2ShoulderAngle);
    expect(motion).toBeGreaterThan(.01);
    expect(motion).toBeLessThanOrEqual(AVATAR_V2_SHOULDER_MAX_ANGLE + 1e-6);
  });

  it('re-solves from rest instead of accumulating when collision IK retries the same arm', () => {
    const root = rig();
    const controller = createAvatarV2ShoulderController(root)!;
    const target = new T.Vector3(.6, 1.35, .42);

    controller.aim('L', target);
    const shoulder = root.getObjectByName('Shoulder.L') as T.Bone;
    const first = shoulder.quaternion.clone();

    controller.aim('L', target);
    expect(first.angleTo(shoulder.quaternion)).toBeLessThan(1e-6);
  });

  it('leaves a near-rest reach inside the dead zone untouched', () => {
    const root = rig();
    const controller = createAvatarV2ShoulderController(root)!;
    const shoulder = root.getObjectByName('Shoulder.R') as T.Bone;
    const upper = root.getObjectByName('UpperArm.R') as T.Bone;
    const shoulderWorld = shoulder.getWorldPosition(new T.Vector3());
    const restDirection = upper.getWorldPosition(new T.Vector3()).sub(shoulderWorld).normalize();
    const target = shoulderWorld.clone().addScaledVector(restDirection, .8);

    controller.aim('R', target);

    expect(Number(shoulder.userData.rockmundoAvatarV2ShoulderAngle)).toBe(0);
    expect(new T.Quaternion().angleTo(shoulder.quaternion)).toBeLessThan(1e-6);
  });

  it('does not activate for the legacy avatar engine', () => {
    const root = rig();
    delete root.userData.rockmundoAvatarEngine;
    expect(createAvatarV2ShoulderController(root)).toBeNull();
  });
});
