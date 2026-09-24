import { describe, expect, it } from 'vitest';
import * as T from 'three';
import {
  AvatarV2PoseCorrectiveController,
  createAvatarV2PoseCorrectiveController,
} from './avatarV2PoseCorrectives';

function rig() {
  const root = new T.Group();
  root.userData.rockmundoAvatarEngine = 'rockmundo-v2';

  for (const name of [
    'UpperArm.L', 'UpperArm.R',
    'LowerArm.L', 'LowerArm.R',
    'UpperLeg.L', 'UpperLeg.R',
    'LowerLeg.L', 'LowerLeg.R',
  ]) {
    const bone = new T.Bone();
    bone.name = name;
    root.add(bone);
  }

  const mesh = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial());
  mesh.morphTargetDictionary = {
    poseShoulderLeft: 0,
    poseShoulderRight: 1,
    poseElbowLeft: 2,
    poseElbowRight: 3,
    poseHipLeft: 4,
    poseHipRight: 5,
    poseKneeLeft: 6,
    poseKneeRight: 7,
  };
  mesh.morphTargetInfluences = Array(8).fill(0);
  root.add(mesh);
  return { root, mesh };
}

describe('Avatar V2 pose correctives', () => {
  it('drives shoulder/elbow/hip/knee shape keys from the final local joint pose', () => {
    const { root, mesh } = rig();
    const controller = new AvatarV2PoseCorrectiveController(root);

    (root.getObjectByName('UpperArm.L') as T.Bone).rotateZ(.8);
    (root.getObjectByName('LowerArm.L') as T.Bone).rotateX(1.1);
    (root.getObjectByName('UpperLeg.R') as T.Bone).rotateX(.75);
    (root.getObjectByName('LowerLeg.R') as T.Bone).rotateX(1.15);
    controller.update();

    expect(mesh.morphTargetInfluences![0]).toBeGreaterThan(.4);
    expect(mesh.morphTargetInfluences![2]).toBeGreaterThan(.4);
    expect(mesh.morphTargetInfluences![5]).toBeGreaterThan(.4);
    expect(mesh.morphTargetInfluences![7]).toBeGreaterThan(.4);
    expect(mesh.morphTargetInfluences![1]).toBe(0);
    expect(mesh.morphTargetInfluences![3]).toBe(0);
  });

  it('resets the corrective layer without touching the rig pose', () => {
    const { root, mesh } = rig();
    const controller = new AvatarV2PoseCorrectiveController(root);
    const elbow = root.getObjectByName('LowerArm.L') as T.Bone;
    elbow.rotateX(1.2);
    const posed = elbow.quaternion.clone();

    controller.update();
    expect(mesh.morphTargetInfluences![2]).toBeGreaterThan(0);
    controller.reset();

    expect(mesh.morphTargetInfluences!.every(value => value === 0)).toBe(true);
    expect(elbow.quaternion.equals(posed)).toBe(true);
  });

  it('only creates for V2 models with usable corrective morphs and joints', () => {
    const { root } = rig();
    expect(createAvatarV2PoseCorrectiveController(root)).toBeInstanceOf(AvatarV2PoseCorrectiveController);

    root.userData.rockmundoAvatarEngine = 'legacy-v1';
    expect(createAvatarV2PoseCorrectiveController(root)).toBeNull();
  });
});
