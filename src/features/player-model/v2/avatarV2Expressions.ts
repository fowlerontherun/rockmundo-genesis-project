import * as T from 'three';

export type AvatarV2Expression =
  | 'blinkLeft'
  | 'blinkRight'
  | 'jawOpen'
  | 'mouthSmile'
  | 'mouthFunnel'
  | 'mouthPucker'
  | 'eyeSquintLeft'
  | 'eyeSquintRight'
  | 'browInnerUp'
  | 'browDownLeft'
  | 'browDownRight'
  | 'cheekSquintLeft'
  | 'cheekSquintRight'
  | 'mouthStretchLeft'
  | 'mouthStretchRight'
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
  eyeSquintLeft: ['eyeSquintLeft', 'eye_squint_l', 'squintLeft', 'squint_l'],
  eyeSquintRight: ['eyeSquintRight', 'eye_squint_r', 'squintRight', 'squint_r'],
  browInnerUp: ['browInnerUp', 'brow_inner_up', 'innerBrowRaise', 'browRaiseInner'],
  browDownLeft: ['browDownLeft', 'brow_down_l', 'browLowerLeft', 'browLower_l'],
  browDownRight: ['browDownRight', 'brow_down_r', 'browLowerRight', 'browLower_r'],
  cheekSquintLeft: ['cheekSquintLeft', 'cheek_squint_l', 'cheekRaiseLeft', 'cheekRaise_l'],
  cheekSquintRight: ['cheekSquintRight', 'cheek_squint_r', 'cheekRaiseRight', 'cheekRaise_r'],
  mouthStretchLeft: ['mouthStretchLeft', 'mouth_stretch_l', 'mouthWideLeft', 'mouth_wide_l'],
  mouthStretchRight: ['mouthStretchRight', 'mouth_stretch_r', 'mouthWideRight', 'mouth_wide_r'],
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

    const vocalActive = state.vocalActive && !state.reducedMotion;
    const vocal = vocalActive
      ? T.MathUtils.clamp(state.opening * (.72 + state.energy * .36), 0, 1)
      : 0;
    const phrasePulse = vocalActive
      ? Math.pow(Math.max(0, Math.sin(t * 1.18 + state.phase * .73)), 1.35)
      : 0;
    const faceEnergy = vocalActive
      ? T.MathUtils.clamp(.10 + state.energy * .58 + vocal * .24, 0, 1)
      : 0;

    setWeight(this.bindings, 'jawOpen', vocal);
    setWeight(
      this.bindings,
      'mouthSmile',
      vocalActive
        ? T.MathUtils.clamp(.045 + phrasePulse * .10 + state.energy * .05 - vocal * .035, 0, .22)
        : .025,
    );

    const squint = vocal * (.08 + state.energy * .22) + phrasePulse * state.energy * .08;
    setWeight(this.bindings, 'eyeSquintLeft', squint * .96);
    setWeight(this.bindings, 'eyeSquintRight', squint);
    setWeight(this.bindings, 'cheekSquintLeft', faceEnergy * (.08 + phrasePulse * .12));
    setWeight(this.bindings, 'cheekSquintRight', faceEnergy * (.075 + phrasePulse * .115));

    const browLift = vocal * (.04 + state.opening * .15) * (1 - state.energy * .28);
    const browDrive = vocal * state.energy * (.055 + phrasePulse * .09);
    setWeight(this.bindings, 'browInnerUp', browLift);
    setWeight(this.bindings, 'browDownLeft', browDrive * .94);
    setWeight(this.bindings, 'browDownRight', browDrive);

    clearVisemes(this.bindings);
    setWeight(this.bindings, 'mouthFunnel', 0);
    setWeight(this.bindings, 'mouthPucker', 0);
    setWeight(this.bindings, 'mouthStretchLeft', 0);
    setWeight(this.bindings, 'mouthStretchRight', 0);

    if (vocal <= .02) return;

    // Blend between neighbouring pseudo-phonemes instead of snapping one viseme
    // on/off every beat. This stays deterministic for replay/TOTP rendering while
    // producing much smoother lips, cheeks and jaw motion. Real audio timings can
    // later feed the same expression weights without changing the mesh contract.
    const visemes = ['visemeAA', 'visemeEE', 'visemeIH', 'visemeOH', 'visemeOU'] as const;
    const cycle = ((t * 3.4) % visemes.length + visemes.length) % visemes.length;
    const slot = Math.floor(cycle);
    const nextSlot = (slot + 1) % visemes.length;
    const local = cycle - slot;
    const blend = T.MathUtils.smoothstep(local, .12, .88);
    const amplitude = Math.min(.82, vocal * .9);
    const currentWeight = amplitude * (1 - blend);
    const nextWeight = amplitude * blend;
    setWeight(this.bindings, visemes[slot], currentWeight);
    setWeight(this.bindings, visemes[nextSlot], nextWeight);

    const contribution = (index: number) =>
      (slot === index ? currentWeight : 0) + (nextSlot === index ? nextWeight : 0);
    const rounded = contribution(3);
    const puckered = contribution(4);
    const stretched = contribution(1) + contribution(2);
    setWeight(this.bindings, 'mouthFunnel', rounded * .38);
    setWeight(this.bindings, 'mouthPucker', puckered * .42);
    setWeight(this.bindings, 'mouthStretchLeft', stretched * .24);
    setWeight(this.bindings, 'mouthStretchRight', stretched * .245);
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
