import * as T from 'three';
import { REQUIRED_FACE_CHANNELS } from './avatarV2FaceAudit';

export type AvatarV2FaceChannel = typeof REQUIRED_FACE_CHANNELS[number];
export type AvatarV2FacePose = Partial<Record<AvatarV2FaceChannel, number>>;

export interface AvatarV2FaceController {
  readonly channels: readonly AvatarV2FaceChannel[];
  setPose(pose: AvatarV2FacePose): void;
  transitionTo(pose: AvatarV2FacePose, seconds: number): void;
  update(deltaSeconds: number): void;
  reset(): void;
}

/**
 * Controls only authored facial morphs on the loaded V2 mesh. Never creates a
 * synthetic floating mouth or silently substitutes a missing expression.
 * Call update with playback delta (not wall-clock time) for deterministic replay.
 */
export function createAvatarV2FaceController(root: T.Object3D): AvatarV2FaceController | null {
  const targets = new Map<AvatarV2FaceChannel, Array<{ mesh: T.Mesh; index: number }>>();
  root.traverse(node => {
    if (!(node instanceof T.Mesh) || !node.morphTargetDictionary || !node.morphTargetInfluences) return;
    for (const name of REQUIRED_FACE_CHANNELS) {
      const index = node.morphTargetDictionary[name];
      if (index === undefined || index < 0 || index >= node.morphTargetInfluences.length) continue;
      const group = targets.get(name) ?? [];
      group.push({ mesh: node, index });
      targets.set(name, group);
    }
  });
  if (!targets.size) return null;
  const channels = REQUIRED_FACE_CHANNELS.filter(name => targets.has(name));
  const values = new Map<AvatarV2FaceChannel, number>(channels.map(name => [name, 0]));
  let elapsed = 0;
  let duration = 0;
  let start = new Map(values);
  let goal = new Map(values);
  const apply = () => {
    for (const [name, value] of values) {
      for (const { mesh, index } of targets.get(name) ?? []) {
        mesh.morphTargetInfluences![index] = value;
      }
    }
  };
  const normalize = (pose: AvatarV2FacePose) => new Map(channels.map(name => {
    const raw = pose[name] ?? 0;
    return [name, Number.isFinite(raw) ? T.MathUtils.clamp(raw, 0, 1) : 0] as const;
  }));
  return {
    channels,
    setPose(pose) {
      values.clear();
      for (const [name, value] of normalize(pose)) values.set(name, value);
      elapsed = duration = 0;
      apply();
    },
    transitionTo(pose, seconds) {
      start = new Map(values);
      goal = normalize(pose);
      elapsed = 0;
      duration = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
      if (!duration) this.setPose(pose);
    },
    update(deltaSeconds) {
      if (!duration || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
      elapsed = Math.min(duration, elapsed + deltaSeconds);
      const t = elapsed / duration;
      for (const name of channels) {
        values.set(name, T.MathUtils.lerp(start.get(name) ?? 0, goal.get(name) ?? 0, t));
      }
      apply();
      if (elapsed >= duration) duration = 0;
    },
    reset() {
      this.setPose({});
    },
  };
}

/** Neutral-to-expression presets for preview; singing visemes use the same channels. */
export const AVATAR_V2_FACE_PRESETS = {
  neutral: {},
  blink: { eyeBlinkLeft: 1, eyeBlinkRight: 1 },
  smile: { mouthSmileLeft: .85, mouthSmileRight: .85, browInnerUp: .15 },
  singingOpen: { jawOpen: .85, mouthFunnel: .25 },
  singingRounded: { jawOpen: .35, mouthPucker: .8, mouthFunnel: .65 },
  surprised: { jawOpen: .55, browInnerUp: .95 },
} satisfies Record<string, AvatarV2FacePose>;
