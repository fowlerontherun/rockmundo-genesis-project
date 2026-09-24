import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { createAvatarV2TwistController } from './avatarV2TwistBones';

function rig() {
  const root = new T.Group();
  root.userData.rockmundoAvatarEngine = 'rockmundo-v2';

  for (const side of ['L', 'R'] as const) {
    const sign = side === 'L' ? 1 : -1;

    const upperArm = new T.Bone();
    upperArm.name = `UpperArm.${side}`;
    root.add(upperArm);

    const lowerArm = new T.Bone();
    lowerArm.name = `LowerArm.${side}`;
    lowerArm.position.set(sign * .4, 0, 0);
    upperArm.add(lowerArm);

    const upperTwist = new T.Bone();
    upperTwist.name = `UpperArmTwist.${side}`;
    upperTwist.position.set(sign * .2, 0, 0);
    upperArm.add(upperTwist);

    const hand = new T.Bone();
    hand.name = `Hand.${side}`;
    hand.position.set(sign * .4, 0, 0);
    lowerArm.add(hand);

    const forearmTwist = new T.Bone();
    forearmTwist.name = `ForearmTwist.${side}`;
    forearmTwist.position.set(sign * .2, 0, 0);
    lowerArm.add(forearmTwist);

    const upperLeg = new T.Bone();
    upperLeg.name = `UpperLeg.${side}`;
    root.add(upperLeg);

    const lowerLeg = new T.Bone();
    lowerLeg.name = `LowerLeg.${side}`;
    lowerLeg.position.set(0, -.45, 0);
    upperLeg.add(lowerLeg);

    const thighTwist = new T.Bone();
    thighTwist.name = `ThighTwist.${side}`;
    thighTwist.position.set(0, -.22, 0);
    upperLeg.add(thighTwist);
  }

  root.updateMatrixWorld(true);
  return root;
}

describe('Avatar V2 limb twist deformation', () => {
  it('distributes upper-arm, forearm and thigh axial rotation onto helper bones', () => {
    const root = rig();
    const controller = createAvatarV2TwistController(root);
    expect(controller).not.toBeNull();
    expect(root.userData.rockmundoAvatarV2TwistDeformation).toEqual({ active: 6, required: 6 });

    const lowerArm = root.getObjectByName('LowerArm.L') as T.Bone;
    const hand = root.getObjectByName('Hand.L') as T.Bone;
    const lowerLeg = root.getObjectByName('LowerLeg.L') as T.Bone;
    lowerArm.quaternion.setFromAxisAngle(new T.Vector3(1, 0, 0), .8);
    hand.quaternion.setFromAxisAngle(new T.Vector3(1, 0, 0), .6);
    lowerLeg.quaternion.setFromAxisAngle(new T.Vector3(0, -1, 0), .7);

    controller!.update();

    const upperTwist = root.getObjectByName('UpperArmTwist.L') as T.Bone;
    const forearmTwist = root.getObjectByName('ForearmTwist.L') as T.Bone;
    const thighTwist = root.getObjectByName('ThighTwist.L') as T.Bone;
    expect(new T.Quaternion().angleTo(upperTwist.quaternion)).toBeCloseTo(.8 * .45, 4);
    expect(new T.Quaternion().angleTo(forearmTwist.quaternion)).toBeCloseTo(.6 * .65, 4);
    expect(new T.Quaternion().angleTo(thighTwist.quaternion)).toBeCloseTo(.7 * .42, 4);
  });

  it('ignores swing around another axis instead of double-bending the helper', () => {
    const root = rig();
    const controller = createAvatarV2TwistController(root)!;
    const lowerArm = root.getObjectByName('LowerArm.L') as T.Bone;
    lowerArm.quaternion.setFromAxisAngle(new T.Vector3(0, 0, 1), 1.0);

    controller.update();

    const upperTwist = root.getObjectByName('UpperArmTwist.L') as T.Bone;
    expect(new T.Quaternion().angleTo(upperTwist.quaternion)).toBeLessThan(.001);
  });

  it('restores helper bones without changing the driving pose', () => {
    const root = rig();
    const controller = createAvatarV2TwistController(root)!;
    const hand = root.getObjectByName('Hand.R') as T.Bone;
    hand.quaternion.setFromAxisAngle(new T.Vector3(-1, 0, 0), .55);
    controller.update();

    const helper = root.getObjectByName('ForearmTwist.R') as T.Bone;
    expect(new T.Quaternion().angleTo(helper.quaternion)).toBeGreaterThan(.2);

    controller.reset();
    expect(new T.Quaternion().angleTo(helper.quaternion)).toBeLessThan(.0001);
    expect(new T.Quaternion().angleTo(hand.quaternion)).toBeCloseTo(.55, 4);
  });

  it('does not activate outside Avatar V2', () => {
    const root = rig();
    delete root.userData.rockmundoAvatarEngine;
    expect(createAvatarV2TwistController(root)).toBeNull();
  });
});
