import * as T from 'three';

export type AvatarV2ToeSide = 'L' | 'R';

interface ToeBinding {
  foot: T.Bone;
  toe: T.Bone;
  restLocal: T.Quaternion;
}

export const AVATAR_V2_TOE_RUNTIME_BONES = ['Toe.L', 'Toe.R'] as const;
export const AVATAR_V2_TOE_MAX_LIFT_ANGLE = .42;
export const AVATAR_V2_TOE_MAX_PRESS_ANGLE = .20;

const WORLD_UP = new T.Vector3(0, 1, 0);

/**
 * Adds authored toe-base articulation to live Avatar V2 performers.
 *
 * The controller derives the hinge axis from the actual ankle -> toe-base vector
 * instead of assuming a particular imported bone axis. That makes the runtime
 * compatible with the RockMundo Blender guide and equivalent correctly-authored
 * GLBs while still preserving each asset's authored toe rest rotation.
 */
export class AvatarV2ToeController {
  private readonly bindings = new Map<AvatarV2ToeSide, ToeBinding>();

  constructor(private readonly root: T.Object3D) {
    for (const side of ['L', 'R'] as const) {
      const foot = root.getObjectByName(`Foot.${side}`);
      const toe = root.getObjectByName(`Toe.${side}`);
      if (!(foot instanceof T.Bone) || !(toe instanceof T.Bone)) continue;
      this.bindings.set(side, {
        foot,
        toe,
        restLocal: toe.quaternion.clone(),
      });
    }

    root.userData.rockmundoAvatarV2ToeArticulation = {
      active: this.bindings.size,
      required: 2,
    };
  }

  get active() {
    return this.bindings.size > 0;
  }

  /**
   * @param amount normalized toe flex. Positive lifts/curls the forefoot,
   * negative presses it down. Values are clamped to [-1, 1].
   */
  flex(side: AvatarV2ToeSide, amount: number) {
    const binding = this.bindings.get(side);
    if (!binding) return;

    const { foot, toe, restLocal } = binding;
    toe.quaternion.copy(restLocal);
    this.root.updateMatrixWorld(true);

    const footWorld = foot.getWorldPosition(new T.Vector3());
    const toeWorld = toe.getWorldPosition(new T.Vector3());
    const forward = toeWorld.sub(footWorld);
    if (forward.lengthSq() < 1e-8) {
      toe.userData.rockmundoAvatarV2ToeAngle = 0;
      return;
    }
    forward.normalize();

    const up = WORLD_UP.clone().applyQuaternion(this.root.getWorldQuaternion(new T.Quaternion())).normalize();
    let lateral = forward.clone().cross(up);
    if (lateral.lengthSq() < 1e-8) {
      lateral = new T.Vector3(1, 0, 0).applyQuaternion(this.root.getWorldQuaternion(new T.Quaternion()));
    } else {
      lateral.normalize();
    }

    const normalized = T.MathUtils.clamp(amount, -1, 1);
    const angle = normalized >= 0
      ? normalized * AVATAR_V2_TOE_MAX_LIFT_ANGLE
      : normalized * AVATAR_V2_TOE_MAX_PRESS_ANGLE;

    if (Math.abs(angle) < 1e-6) {
      toe.userData.rockmundoAvatarV2ToeAngle = 0;
      toe.updateWorldMatrix(false, true);
      return;
    }

    const worldDelta = new T.Quaternion().setFromAxisAngle(lateral, angle);
    const currentWorld = toe.getWorldQuaternion(new T.Quaternion());
    const desiredWorld = worldDelta.multiply(currentWorld);
    const parentWorld = toe.parent?.getWorldQuaternion(new T.Quaternion()) ?? new T.Quaternion();

    toe.quaternion.copy(parentWorld.invert().multiply(desiredWorld));
    toe.updateWorldMatrix(false, true);

    const actual = restLocal.angleTo(toe.quaternion);
    toe.userData.rockmundoAvatarV2ToeAngle = Number.isFinite(actual)
      ? Math.sign(normalized) * actual
      : Number.NaN;
  }

  reset() {
    for (const { toe, restLocal } of this.bindings.values()) {
      toe.quaternion.copy(restLocal);
      toe.userData.rockmundoAvatarV2ToeAngle = 0;
    }
    this.root.updateMatrixWorld(true);
  }
}

export function createAvatarV2ToeController(root: T.Object3D) {
  if (root.userData.rockmundoAvatarEngine !== 'rockmundo-v2') return null;
  const controller = new AvatarV2ToeController(root);
  return controller.active ? controller : null;
}
