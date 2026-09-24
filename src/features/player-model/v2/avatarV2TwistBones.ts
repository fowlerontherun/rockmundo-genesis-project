import * as T from 'three';

export type AvatarV2TwistSemantic =
  | 'leftUpperArmTwist'
  | 'rightUpperArmTwist'
  | 'leftForearmTwist'
  | 'rightForearmTwist'
  | 'leftThighTwist'
  | 'rightThighTwist';

export const AVATAR_V2_TWIST_BONE_ALIASES: Record<AvatarV2TwistSemantic, readonly string[]> = {
  leftUpperArmTwist: ['UpperArmTwist.L', 'upperarm_twist_l', 'upper_arm_twist_l', 'leftUpperArmTwist'],
  rightUpperArmTwist: ['UpperArmTwist.R', 'upperarm_twist_r', 'upper_arm_twist_r', 'rightUpperArmTwist'],
  leftForearmTwist: ['ForearmTwist.L', 'forearm_twist_l', 'lowerarm_twist_l', 'leftForearmTwist'],
  rightForearmTwist: ['ForearmTwist.R', 'forearm_twist_r', 'lowerarm_twist_r', 'rightForearmTwist'],
  leftThighTwist: ['ThighTwist.L', 'thigh_twist_l', 'upperleg_twist_l', 'leftThighTwist'],
  rightThighTwist: ['ThighTwist.R', 'thigh_twist_r', 'upperleg_twist_r', 'rightThighTwist'],
} as const;

export const AVATAR_V2_TWIST_RUNTIME_NAMES: Record<AvatarV2TwistSemantic, string> = {
  leftUpperArmTwist: 'UpperArmTwist.L',
  rightUpperArmTwist: 'UpperArmTwist.R',
  leftForearmTwist: 'ForearmTwist.L',
  rightForearmTwist: 'ForearmTwist.R',
  leftThighTwist: 'ThighTwist.L',
  rightThighTwist: 'ThighTwist.R',
};

export const AVATAR_V2_TWIST_PARENT_BONES: Record<AvatarV2TwistSemantic, string> = {
  leftUpperArmTwist: 'UpperArm.L',
  rightUpperArmTwist: 'UpperArm.R',
  leftForearmTwist: 'LowerArm.L',
  rightForearmTwist: 'LowerArm.R',
  leftThighTwist: 'UpperLeg.L',
  rightThighTwist: 'UpperLeg.R',
};

interface TwistConfig {
  semantic: AvatarV2TwistSemantic;
  helper: string;
  driver: string;
  share: number;
  maxAngle: number;
}

const CONFIGS: readonly TwistConfig[] = [
  { semantic: 'leftUpperArmTwist', helper: 'UpperArmTwist.L', driver: 'LowerArm.L', share: .45, maxAngle: 1.15 },
  { semantic: 'rightUpperArmTwist', helper: 'UpperArmTwist.R', driver: 'LowerArm.R', share: .45, maxAngle: 1.15 },
  { semantic: 'leftForearmTwist', helper: 'ForearmTwist.L', driver: 'Hand.L', share: .65, maxAngle: 1.30 },
  { semantic: 'rightForearmTwist', helper: 'ForearmTwist.R', driver: 'Hand.R', share: .65, maxAngle: 1.30 },
  { semantic: 'leftThighTwist', helper: 'ThighTwist.L', driver: 'LowerLeg.L', share: .42, maxAngle: .95 },
  { semantic: 'rightThighTwist', helper: 'ThighTwist.R', driver: 'LowerLeg.R', share: .42, maxAngle: .95 },
] as const;

interface Binding {
  helper: T.Bone;
  helperRest: T.Quaternion;
  driver: T.Bone;
  driverRestInverse: T.Quaternion;
  axis: T.Vector3;
  share: number;
  maxAngle: number;
}

function signedTwistAngle(delta: T.Quaternion, axis: T.Vector3) {
  const projection = delta.x * axis.x + delta.y * axis.y + delta.z * axis.z;
  const projectedLength = Math.abs(projection);
  if (projectedLength < 1e-7) return 0;

  // q and -q encode the same rotation. Keep w non-negative so atan2 resolves
  // the shortest deterministic twist instead of occasionally jumping by 2π.
  const signCorrection = delta.w < 0 ? -1 : 1;
  const w = T.MathUtils.clamp(delta.w * signCorrection, -1, 1);
  const signedProjection = projection * signCorrection;
  return 2 * Math.atan2(signedProjection, Math.max(1e-7, w));
}

/**
 * Distributes axial rotation across authored deform helper bones after the live
 * IK/wrist pose is complete. This prevents linear skinning from concentrating
 * shoulder, forearm and thigh twist at a single joint.
 */
export class AvatarV2TwistController {
  private readonly bindings: Binding[] = [];

  constructor(root: T.Object3D) {
    const bones = new Map<string, T.Bone>();
    root.traverse(node => {
      if (node instanceof T.Bone) bones.set(node.name, node);
    });

    for (const config of CONFIGS) {
      const helper = bones.get(config.helper);
      const driver = bones.get(config.driver);
      if (!helper || !driver || !driver.parent) continue;

      // The driver's rest offset is expressed in the same parent coordinate
      // space as its local rotation. It therefore provides a stable long-axis
      // for swing/twist decomposition without assuming Blender bone axes.
      const axis = driver.position.clone();
      if (axis.lengthSq() < 1e-8) continue;
      axis.normalize();

      this.bindings.push({
        helper,
        helperRest: helper.quaternion.clone(),
        driver,
        driverRestInverse: driver.quaternion.clone().invert(),
        axis,
        share: config.share,
        maxAngle: config.maxAngle,
      });
    }

    root.userData.rockmundoAvatarV2TwistDeformation = {
      active: this.bindings.length,
      required: CONFIGS.length,
    };
  }

  get active() {
    return this.bindings.length > 0;
  }

  update() {
    const delta = new T.Quaternion();
    const distributed = new T.Quaternion();

    for (const binding of this.bindings) {
      // current * inverse(rest) yields the driver's local delta in parent space.
      delta.copy(binding.driver.quaternion).multiply(binding.driverRestInverse);
      const angle = T.MathUtils.clamp(
        signedTwistAngle(delta, binding.axis),
        -binding.maxAngle,
        binding.maxAngle,
      ) * binding.share;

      distributed.setFromAxisAngle(binding.axis, angle);
      binding.helper.quaternion.copy(distributed).multiply(binding.helperRest);
    }
  }

  reset() {
    for (const binding of this.bindings) binding.helper.quaternion.copy(binding.helperRest);
  }
}

export function createAvatarV2TwistController(root: T.Object3D) {
  if (root.userData.rockmundoAvatarEngine !== 'rockmundo-v2') return null;
  const controller = new AvatarV2TwistController(root);
  return controller.active ? controller : null;
}

export const AVATAR_V2_TWIST_RUNTIME_BONES = CONFIGS.map(config => config.helper) as readonly string[];
