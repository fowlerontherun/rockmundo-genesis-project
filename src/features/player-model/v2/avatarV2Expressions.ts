import * as T from 'three';

export type AvatarV2Expression =
  | 'blinkLeft'
  | 'blinkRight'
  | 'jawOpen'
  | 'mouthSmile'
  | 'mouthFunnel'
  | 'mouthPucker'
  | 'visemeAA'
  | 'visemeEE'
  | 'visemeIH'
  | 'visemeOH'
  | 'visemeOU';

const ALIASES: Record<AvatarV2Expression, string[]> = {
  blinkLeft: ['blinkLeft', 'blink_l', 'eyeBlinkLeft', 'eye_blink_l'],
  blinkRight: ['blinkRight', 'blink_r', 'eyeBlinkRight', 'eye_blink_r'],
  jawOpen: ['jawOpen', 'jaw_open', 'mouthOpen', 'mouth_open'],
  mouthSmile: ['mouthSmile', 'mouth_smile', 'smile'],
  mouthFunnel: ['mouthFunnel', 'mouth_funnel', 'funnel'],
  mouthPucker: ['mouthPucker', 'mouth_pucker', 'pucker'],
  visemeAA: ['visemeAA', 'viseme_aa', 'aa', 'A'],
  visemeEE: ['visemeEE', 'viseme_ee', 'ee', 'E'],
  visemeIH: ['visemeIH', 'viseme_ih', 'ih', 'I'],
  visemeOH: ['visemeOH', 'viseme_oh', 'oh', 'O'],
  visemeOU: ['visemeOU', 'viseme_ou', 'ou', 'U'],
};

const clean = (value: string) => value.replace(/[^a-z0-9]/gi, '').toLowerCase();

interface MorphBinding {
  mesh: T.Mesh;
  index: number;
}

type BindingMap = Partial<Record<AvatarV2Expression, MorphBinding[]>>;

export interface AvatarV2FaceState {
  seconds: number;
  phase: number;
  vocalActive: boolean;
  opening: number;
  energy: number;
  reducedMotion: boolean;
}

export function collectAvatarV2ExpressionBindings(root: T.Object3D): BindingMap {
  const result: BindingMap = {};

  root.traverse(node => {
    if (!(node instanceof T.Mesh) || !node.morphTargetDictionary || !node.morphTargetInfluences) return;
    const available = new Map(Object.entries(node.morphTargetDictionary).map(([name, index]) => [clean(name), index]));

    for (const expression of Object.keys(ALIASES) as AvatarV2Expression[]) {
      const index = [expression, ...ALIASES[expression]]
        .map(clean)
        .map(name => available.get(name))
        .find(value => value !== undefined);
      if (index === undefined) continue;
      (result[expression] ??= []).push({ mesh: node, index });
    }
  });

  return result;
}

function setWeight(bindings: BindingMap, expression: AvatarV2Expression, weight: number) {
  const clamped = T.MathUtils.clamp(weight, 0, 1);
  for (const binding of bindings[expression] ?? []) {
    if (!binding.mesh.morphTargetInfluences) continue;
    binding.mesh.morphTargetInfluences[binding.index] = clamped;
  }
}

function clearVisemes(bindings: BindingMap) {
  for (const expression of ['visemeAA', 'visemeEE', 'visemeIH', 'visemeOH', 'visemeOU'] as const) {
    setWeight(bindings, expression, 0);
  }
}

/**
 * Drives authored V2 facial blendshapes from the existing deterministic stage
 * performance clock. It is intentionally provider-agnostic: later real audio
 * viseme timings can feed the same expression weights.
 */
export class AvatarV2ExpressionController {
  private readonly bindings: BindingMap;
  readonly supported: AvatarV2Expression[];

  constructor(root: T.Object3D) {
    this.bindings = collectAvatarV2ExpressionBindings(root);
    this.supported = (Object.keys(this.bindings) as AvatarV2Expression[])
      .filter(key => (this.bindings[key]?.length ?? 0) > 0);
  }

  get hasCloseUpFace() {
    return ['blinkLeft', 'blinkRight', 'jawOpen', 'mouthSmile']
      .every(expression => this.supported.includes(expression as AvatarV2Expression));
  }

  update(state: AvatarV2FaceState) {
    const t = state.reducedMotion ? 0 : state.seconds + state.phase * .41;

    // Non-random deterministic blink rhythm: stable in replays and TOTP renders.
    const blinkClock = ((t % 4.85) + 4.85) % 4.85;
    const blink = state.reducedMotion
      ? 0
      : T.MathUtils.smoothstep(blinkClock, 4.54, 4.64)
        * (1 - T.MathUtils.smoothstep(blinkClock, 4.70, 4.80));
    setWeight(this.bindings, 'blinkLeft', blink);
    setWeight(this.bindings, 'blinkRight', blink * .97);

    const vocal = state.vocalActive && !state.reducedMotion
      ? T.MathUtils.clamp(state.opening * (.72 + state.energy * .36), 0, 1)
      : 0;

    setWeight(this.bindings, 'jawOpen', vocal);
    setWeight(this.bindings, 'mouthSmile', state.vocalActive ? .08 + Math.max(0, Math.sin(t * .63)) * .12 : .035);

    clearVisemes(this.bindings);
    setWeight(this.bindings, 'mouthFunnel', 0);
    setWeight(this.bindings, 'mouthPucker', 0);

    if (vocal <= .02) return;

    // A deterministic pseudo-phoneme sequence is better than a generic hinged
    // jaw and remains replay-safe. Real audio-driven visemes can replace the
    // sequence later without changing the mesh contract.
    const slot = Math.floor((t * 3.7) % 5 + 5) % 5;
    const viseme = (['visemeAA', 'visemeEE', 'visemeIH', 'visemeOH', 'visemeOU'] as const)[slot];
    setWeight(this.bindings, viseme, Math.min(.82, vocal * .9));

    if (slot === 3) setWeight(this.bindings, 'mouthFunnel', vocal * .34);
    if (slot === 4) setWeight(this.bindings, 'mouthPucker', vocal * .38);
  }

  reset() {
    for (const expression of Object.keys(ALIASES) as AvatarV2Expression[]) {
      setWeight(this.bindings, expression, 0);
    }
  }
}

export function createAvatarV2ExpressionController(root: T.Object3D) {
  if (root.userData.rockmundoAvatarEngine !== 'rockmundo-v2') return null;
  const controller = new AvatarV2ExpressionController(root);
  return controller.hasCloseUpFace ? controller : null;
}
