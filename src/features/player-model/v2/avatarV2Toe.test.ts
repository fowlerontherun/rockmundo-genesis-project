import { describe, expect, it } from 'vitest';
import * as T from 'three';
import {
  AVATAR_V2_TOE_MAX_LIFT_ANGLE,
  AVATAR_V2_TOE_MAX_PRESS_ANGLE,
  createAvatarV2ToeController,
} from './avatarV2Toe';

function rig() {
  const root = new T.Group();
  root.userData.rockmundoAvatarEngine = 'rockmundo-v2';

  for (const side of ['L', 'R'] as const) {
    const sign = side === 'L' ? 1 : -1;
    const lower = new T.Bone();
    lower.name = `LowerLeg.${side}`;
    lower.position.set(sign * .08, .5, 0);
    root.add(lower);

    const foot = new T.Bone();
    foot.name = `Foot.${side}`;
    foot.position.set(0, -.42, 0);
    lower.add(foot);

    const toe = new T.Bone();
    toe.name = `Toe.${side}`;
    toe.position.set(0, -.035, .16);
    foot.add(toe);
  }

  root.updateMatrixWorld(true);
  return root;
}

describe('Avatar V2 toe articulation', () => {
  it('lifts an authored toe around the live foot-derived hinge axis', () => {
    const root = rig();
    const controller = createAvatarV2ToeController(root)!;
    const toe = root.getObjectByName('Toe.L') as T.Bone;

    controller.flex('L', 1);

    const angle = Number(toe.userData.rockmundoAvatarV2ToeAngle);
    expect(angle).toBeGreaterThan(.1);
    expect(angle).toBeLessThanOrEqual(AVATAR_V2_TOE_MAX_LIFT_ANGLE + 1e-6);
    expect(root.userData.rockmundoAvatarV2ToeArticulation).toEqual({ active: 2, required: 2 });
  });

  it('uses the smaller press range for pedal and planted-foot compression', () => {
    const root = rig();
    const controller = createAvatarV2ToeController(root)!;
    const toe = root.getObjectByName('Toe.R') as T.Bone;

    controller.flex('R', -1);

    const angle = Number(toe.userData.rockmundoAvatarV2ToeAngle);
    expect(angle).toBeLessThan(-.05);
    expect(Math.abs(angle)).toBeLessThanOrEqual(AVATAR_V2_TOE_MAX_PRESS_ANGLE + 1e-6);
  });

  it('re-solves from authored rest instead of accumulating toe rotation', () => {
    const root = rig();
    const controller = createAvatarV2ToeController(root)!;
    const toe = root.getObjectByName('Toe.L') as T.Bone;

    controller.flex('L', .65);
    const first = toe.quaternion.clone();
    controller.flex('L', .65);

    expect(first.angleTo(toe.quaternion)).toBeLessThan(1e-6);
  });

  it('returns to rest when the flex amount is zero', () => {
    const root = rig();
    const controller = createAvatarV2ToeController(root)!;
    const toe = root.getObjectByName('Toe.L') as T.Bone;
    const rest = toe.quaternion.clone();

    controller.flex('L', .8);
    controller.flex('L', 0);

    expect(rest.angleTo(toe.quaternion)).toBeLessThan(1e-6);
    expect(Number(toe.userData.rockmundoAvatarV2ToeAngle)).toBe(0);
  });

  it('does not activate for legacy avatars', () => {
    const root = rig();
    delete root.userData.rockmundoAvatarEngine;
    expect(createAvatarV2ToeController(root)).toBeNull();
  });
});
