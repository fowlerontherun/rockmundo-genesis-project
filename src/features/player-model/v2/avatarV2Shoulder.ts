import * as T from 'three';

export type AvatarV2ShoulderSide = 'L' | 'R';

interface ShoulderBinding {
  shoulder: T.Bone;
  upperArm: T.Bone;
  restLocal: T.Quaternion;
}

const MAX_SHOULDER_ANGLE = .24;
const SHOULDER_SHARE = .34;
const SHOULDER_DEAD_ZONE = .08;

/**
 * Lets the authored V2 clavicles participate in live hand IK. The legacy stage
 * solver historically aimed UpperArm directly at the target, leaving a premium
 * shoulder rig frozen while the arm moved underneath it.
 *
 * Each solve starts from the authored shoulder rest rotation, then rotates only
 * a bounded share of the reach direction into the clavicle. Upper-arm IK runs
 * afterwards, so hand targets stay authoritative while the shoulder volume and
 * silhouette follow raised/forward performance poses.
 */
export class AvatarV2ShoulderController {
  private readonly bindings = new Map<AvatarV2ShoulderSide, ShoulderBinding>();

  constructor(private readonly root: T.Object3D) {
    for (const side of ['L', 'R'] as const) {
      const shoulder = root.getObjectByName(`Shoulder.${side}`);
      const upperArm = root.getObjectByName(`UpperArm.${side}`);
      if (!(shoulder instanceof T.Bone) || !(upperArm instanceof T.Bone)) continue;
      this.bindings.set(side, {
        shoulder,
        upperArm,
        restLocal: shoulder.quaternion.clone(),
      });
    }

    root.userData.rockmundoAvatarV2ShoulderGirdle = {
      active: this.bindings.size,
      required: 2,
    };
  }

  get active() {
    return this.bindings.size > 0;
  }

  aim(side: AvatarV2ShoulderSide, target: T.Vector3) {
    const binding = this.bindings.get(side);
    if (!binding) return;

    const { shoulder, upperArm, restLocal } = binding;

    // Re-solve from authored rest on every call. Instrument collision correction
    // may request a second IK pass in the same frame; accumulating clavicle
    // rotation across those retries would slowly over-rotate the shoulder.
    shoulder.quaternion.copy(restLocal);
    this.root.updateMatrixWorld(true);

    const start = shoulder.getWorldPosition(new T.Vector3());
    const current = upperArm.getWorldPosition(new T.Vector3()).sub(start);
    const desired = target.clone().sub(start);
    if (current.lengthSq() < 1e-8 || desired.lengthSq() < 1e-8) {
      shoulder.userData.rockmundoAvatarV2ShoulderAngle = 0;
      return;
    }

    current.normalize();
    desired.normalize();
    const reachAngle = current.angleTo(desired);
    if (!Number.isFinite(reachAngle) || reachAngle <= SHOULDER_DEAD_ZONE) {
      shoulder.userData.rockmundoAvatarV2ShoulderAngle = 0;
      return;
    }

    const wanted = T.MathUtils.clamp(
      (reachAngle - SHOULDER_DEAD_ZONE) * SHOULDER_SHARE,
      0,
      MAX_SHOULDER_ANGLE,
    );
    const fraction = Math.min(1, wanted / Math.max(reachAngle, 1e-6));
    const worldDelta = new T.Quaternion().setFromUnitVectors(current, desired);
    const limitedDelta = new T.Quaternion().identity().slerp(worldDelta, fraction);
    const currentWorld = shoulder.getWorldQuaternion(new T.Quaternion());
    const desiredWorld = limitedDelta.multiply(currentWorld);

    const parentWorld = shoulder.parent?.getWorldQuaternion(new T.Quaternion()) ?? new T.Quaternion();
    shoulder.quaternion.copy(parentWorld.invert().multiply(desiredWorld));
    shoulder.updateWorldMatrix(false, true);

    const actual = restLocal.angleTo(shoulder.quaternion);
    shoulder.userData.rockmundoAvatarV2ShoulderAngle = Number.isFinite(actual) ? actual : 0;
  }

  reset() {
    for (const { shoulder, restLocal } of this.bindings.values()) {
      shoulder.quaternion.copy(restLocal);
      shoulder.userData.rockmundoAvatarV2ShoulderAngle = 0;
    }
    this.root.updateMatrixWorld(true);
  }
}

export function createAvatarV2ShoulderController(root: T.Object3D) {
  if (root.userData.rockmundoAvatarEngine !== 'rockmundo-v2') return null;
  const controller = new AvatarV2ShoulderController(root);
  return controller.active ? controller : null;
}

export const AVATAR_V2_SHOULDER_RUNTIME_BONES = ['Shoulder.L', 'Shoulder.R'] as const;
export const AVATAR_V2_SHOULDER_MAX_ANGLE = MAX_SHOULDER_ANGLE;
