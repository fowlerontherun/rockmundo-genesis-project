import * as T from 'three';

export type AvatarV2PoseCorrective =
  | 'poseShoulderLeft'
  | 'poseShoulderRight'
  | 'poseElbowLeft'
  | 'poseElbowRight'
  | 'poseHipLeft'
  | 'poseHipRight'
  | 'poseKneeLeft'
  | 'poseKneeRight';

export const AVATAR_V2_POSE_CORRECTIVES: readonly AvatarV2PoseCorrective[] = [
  'poseShoulderLeft',
  'poseShoulderRight',
  'poseElbowLeft',
  'poseElbowRight',
  'poseHipLeft',
  'poseHipRight',
  'poseKneeLeft',
  'poseKneeRight',
] as const;

const ALIASES: Record<AvatarV2PoseCorrective, string[]> = {
  poseShoulderLeft: ['poseShoulderLeft', 'shoulderCorrectiveLeft', 'shoulderFlexLeft', 'pose_shoulder_l'],
  poseShoulderRight: ['poseShoulderRight', 'shoulderCorrectiveRight', 'shoulderFlexRight', 'pose_shoulder_r'],
  poseElbowLeft: ['poseElbowLeft', 'elbowCorrectiveLeft', 'elbowFlexLeft', 'pose_elbow_l'],
  poseElbowRight: ['poseElbowRight', 'elbowCorrectiveRight', 'elbowFlexRight', 'pose_elbow_r'],
  poseHipLeft: ['poseHipLeft', 'hipCorrectiveLeft', 'hipFlexLeft', 'pose_hip_l'],
  poseHipRight: ['poseHipRight', 'hipCorrectiveRight', 'hipFlexRight', 'pose_hip_r'],
  poseKneeLeft: ['poseKneeLeft', 'kneeCorrectiveLeft', 'kneeFlexLeft', 'pose_knee_l'],
  poseKneeRight: ['poseKneeRight', 'kneeCorrectiveRight', 'kneeFlexRight', 'pose_knee_r'],
};

const JOINTS: Record<AvatarV2PoseCorrective, { bone: string; start: number; full: number }> = {
  poseShoulderLeft: { bone: 'UpperArm.L', start: .20, full: 1.05 },
  poseShoulderRight: { bone: 'UpperArm.R', start: .20, full: 1.05 },
  poseElbowLeft: { bone: 'LowerArm.L', start: .16, full: 1.45 },
  poseElbowRight: { bone: 'LowerArm.R', start: .16, full: 1.45 },
  poseHipLeft: { bone: 'UpperLeg.L', start: .18, full: 1.02 },
  poseHipRight: { bone: 'UpperLeg.R', start: .18, full: 1.02 },
  poseKneeLeft: { bone: 'LowerLeg.L', start: .16, full: 1.45 },
  poseKneeRight: { bone: 'LowerLeg.R', start: .16, full: 1.45 },
};

const clean = (value: string) => value.replace(/[^a-z0-9]/gi, '').toLowerCase();

interface MorphBinding {
  mesh: T.Mesh;
  index: number;
}

type BindingMap = Partial<Record<AvatarV2PoseCorrective, MorphBinding[]>>;

function collectBindings(root: T.Object3D): BindingMap {
  const result: BindingMap = {};
  root.traverse(node => {
    if (!(node instanceof T.Mesh) || !node.morphTargetDictionary || !node.morphTargetInfluences) return;
    const available = new Map(Object.entries(node.morphTargetDictionary).map(([name, index]) => [clean(name), index]));

    for (const corrective of AVATAR_V2_POSE_CORRECTIVES) {
      const index = ALIASES[corrective]
        .map(clean)
        .map(name => available.get(name))
        .find(value => value !== undefined);
      if (index === undefined) continue;
      (result[corrective] ??= []).push({ mesh: node, index });
    }
  });
  return result;
}

export function supportedAvatarV2PoseCorrectives(root: T.Object3D) {
  const bindings = collectBindings(root);
  return AVATAR_V2_POSE_CORRECTIVES.filter(key => (bindings[key]?.length ?? 0) > 0);
}

function setWeight(bindings: BindingMap, corrective: AvatarV2PoseCorrective, value: number) {
  const next = T.MathUtils.clamp(value, 0, 1);
  for (const binding of bindings[corrective] ?? []) {
    if (!binding.mesh.morphTargetInfluences) continue;
    binding.mesh.morphTargetInfluences[binding.index] = next;
  }
}

interface JointBinding {
  bone: T.Bone;
  rest: T.Quaternion;
  start: number;
  full: number;
}

/**
 * Drives authored pose-space deformation targets from the final live rig pose.
 *
 * Skinning alone cannot preserve shoulder volume or stop elbows/knees collapsing
 * during the extreme instrument poses RockMundo uses. These correctives are
 * optional at runtime but recommended for LOD0/LOD1 authoring. The controller
 * reads the final local joint rotation after IK/finger posing, so gigs and TOTP
 * receive the same deterministic deformation without changing animation logic.
 */
export class AvatarV2PoseCorrectiveController {
  private readonly bindings: BindingMap;
  private readonly joints = new Map<AvatarV2PoseCorrective, JointBinding>();
  readonly supported: AvatarV2PoseCorrective[];

  constructor(root: T.Object3D) {
    this.bindings = collectBindings(root);
    this.supported = AVATAR_V2_POSE_CORRECTIVES.filter(key => (this.bindings[key]?.length ?? 0) > 0);

    const bones = new Map<string, T.Bone>();
    root.traverse(node => {
      if (node instanceof T.Bone) bones.set(node.name, node);
    });

    for (const corrective of this.supported) {
      const config = JOINTS[corrective];
      const bone = bones.get(config.bone);
      if (!bone) continue;
      this.joints.set(corrective, {
        bone,
        rest: bone.quaternion.clone(),
        start: config.start,
        full: config.full,
      });
    }

    root.userData.rockmundoAvatarV2PoseCorrectives = {
      supported: [...this.supported],
      joints: this.joints.size,
    };
  }

  get active() {
    return this.joints.size > 0;
  }

  update() {
    for (const corrective of AVATAR_V2_POSE_CORRECTIVES) {
      const joint = this.joints.get(corrective);
      if (!joint) {
        setWeight(this.bindings, corrective, 0);
        continue;
      }

      const angle = joint.rest.angleTo(joint.bone.quaternion);
      const weight = T.MathUtils.smoothstep(angle, joint.start, joint.full);
      setWeight(this.bindings, corrective, weight);
    }
  }

  reset() {
    for (const corrective of AVATAR_V2_POSE_CORRECTIVES) setWeight(this.bindings, corrective, 0);
  }
}

export function createAvatarV2PoseCorrectiveController(root: T.Object3D) {
  if (root.userData.rockmundoAvatarEngine !== 'rockmundo-v2') return null;
  const controller = new AvatarV2PoseCorrectiveController(root);
  return controller.active ? controller : null;
}
