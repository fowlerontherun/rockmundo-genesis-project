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
  gazeYaw?: number;
  gazePitch?: number;
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

export function readAvatarV2ExpressionWeights(root: T.Object3D) {
  const bindings = collectAvatarV2ExpressionBindings(root);
  const result: Partial<Record<AvatarV2Expression, number>> = {};
  for (const expression of Object.keys(bindings) as AvatarV2Expression[]) {
    let maximum = 0;
    for (const binding of bindings[expression] ?? []) {
      const value = binding.mesh.morphTargetInfluences?.[binding.index] ?? 0;
      if (Number.isFinite(value)) maximum = Math.max(maximum, value);
    }
    result[expression] = maximum;
  }
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

interface EyeBinding {
  bone: T.Bone;
  rest: T.Quaternion;
  side: 'L' | 'R';
}

function deterministicUnit(seed: number) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function blinkPulse(clock: number, start: number, closed: number, opening: number, end: number) {
  return T.MathUtils.smoothstep(clock, start, closed)
    * (1 - T.MathUtils.smoothstep(clock, opening, end));
}

const VOCAL_VISEMES = ['visemeAA', 'visemeEE', 'visemeIH', 'visemeOH', 'visemeOU'] as const;
type VocalViseme = typeof VOCAL_VISEMES[number];

export interface AvatarV2VocalArticulation {
  visemes: Record<VocalViseme, number>;
  jawScale: number;
  funnel: number;
  pucker: number;
  stretchLeft: number;
  stretchRight: number;
}

/**
 * Stateless pseudo-phoneme sampler used when a replay has no authored phoneme
 * timeline. Unlike the old AA→EE→IH→OH→OU loop, this picks deterministic,
 * non-sequential syllable shapes with variable emphasis and brief consonant-like
 * closures. The result is seek/replay safe and can later be replaced by real
 * audio/phoneme timings without changing the facial rig.
 */
export function sampleAvatarV2VocalArticulation(
  seconds: number,
  phase: number,
  vocal: number,
  energy: number,
): AvatarV2VocalArticulation {
  const weights = Object.fromEntries(VOCAL_VISEMES.map(name => [name, 0])) as Record<VocalViseme, number>;
  if (vocal <= .02) {
    return { visemes: weights, jawScale: 0, funnel: 0, pucker: 0, stretchLeft: 0, stretchRight: 0 };
  }

  const rate = 3.05 + T.MathUtils.clamp(energy, 0, 1.25) * .72;
  const syllableClock = Math.max(0, seconds + phase * .19) * rate;
  const slot = Math.floor(syllableClock);
  const local = syllableClock - slot;
  const visemeIndex = (sampleSlot: number) =>
    Math.min(VOCAL_VISEMES.length - 1, Math.floor(deterministicUnit(
      sampleSlot * 5.173 + phase * 11.71 + 2.31,
    ) * VOCAL_VISEMES.length));

  const currentIndex = visemeIndex(slot);
  let nextIndex = visemeIndex(slot + 1);
  if (nextIndex === currentIndex) {
    nextIndex = (nextIndex + 1 + Math.floor(deterministicUnit(slot * 3.91 + phase * 7.7) * 3))
      % VOCAL_VISEMES.length;
  }

  // Most of a syllable holds one readable mouth shape; the final third eases
  // toward the next. Some slots get a short closed-lip onset to suggest consonants
  // without inventing extra blendshape requirements.
  const transition = T.MathUtils.smoothstep(local, .58, .94);
  const consonantSeed = deterministicUnit(slot * 7.13 + phase * 17.17);
  const closureStrength = consonantSeed > .61
    ? (.28 + (consonantSeed - .61) / .39 * .34) * (1 - T.MathUtils.smoothstep(local, .04, .24))
    : 0;
  const syllableAccent = .78 + deterministicUnit(slot * 2.47 + phase * 13.3) * .22;
  const amplitude = Math.min(.84, vocal * .92) * syllableAccent * (1 - closureStrength);

  weights[VOCAL_VISEMES[currentIndex]] = amplitude * (1 - transition);
  weights[VOCAL_VISEMES[nextIndex]] += amplitude * transition;

  const contribution = (index: number) => weights[VOCAL_VISEMES[index]];
  const rounded = contribution(3);
  const puckered = contribution(4);
  const stretched = contribution(1) + contribution(2);
  const asymmetry = (deterministicUnit(slot * 4.31 + phase * 5.9) * 2 - 1) * .035;
  const openBias = contribution(0) * .18 + rounded * .10 - puckered * .05;

  return {
    visemes: weights,
    jawScale: T.MathUtils.clamp(.72 + openBias - closureStrength * .42, .36, 1),
    funnel: rounded * .40 + puckered * .08,
    pucker: puckered * .44 + rounded * .06,
    stretchLeft: stretched * (.245 + asymmetry),
    stretchRight: stretched * (.245 - asymmetry),
  };
}

/**
 * Drives authored V2 facial blendshapes from the existing deterministic stage
 * performance clock. It is intentionally provider-agnostic: later real audio
 * viseme timings can feed the same expression weights.
 */
export class AvatarV2ExpressionController {
  private readonly bindings: BindingMap;
  private readonly eyes: EyeBinding[];
  private readonly jaw: { bone: T.Bone; rest: T.Quaternion } | null;
  readonly supported: AvatarV2Expression[];

  constructor(root: T.Object3D) {
    this.bindings = collectAvatarV2ExpressionBindings(root);
    this.supported = (Object.keys(this.bindings) as AvatarV2Expression[])
      .filter(key => (this.bindings[key]?.length ?? 0) > 0);

    this.eyes = (['L', 'R'] as const)
      .map(side => {
        const bone = root.getObjectByName(`Eye.${side}`);
        return bone instanceof T.Bone
          ? { bone, rest: bone.quaternion.clone(), side }
          : null;
      })
      .filter((eye): eye is EyeBinding => !!eye);

    const jaw = root.getObjectByName('Jaw');
    this.jaw = jaw instanceof T.Bone ? { bone: jaw, rest: jaw.quaternion.clone() } : null;
  }

  get hasCloseUpFace() {
    return ['blinkLeft', 'blinkRight', 'jawOpen', 'mouthSmile']
      .every(expression => this.supported.includes(expression as AvatarV2Expression));
  }

  update(state: AvatarV2FaceState) {
    const t = state.reducedMotion ? 0 : state.seconds + state.phase * .41;

    // Deterministic but non-mechanical blinking: tiny left/right timing variation
    // and an occasional double blink stop close-up faces feeling synchronised or
    // mannequin-like while remaining replay-safe.
    const blinkCycle = 4.72;
    const blinkClock = ((t % blinkCycle) + blinkCycle) % blinkCycle;
    const blinkIndex = Math.floor((t + 0.0001) / blinkCycle);
    const mainLeft = state.reducedMotion ? 0 : blinkPulse(blinkClock, 4.28, 4.37, 4.43, 4.54);
    const mainRight = state.reducedMotion ? 0 : blinkPulse(blinkClock, 4.292, 4.382, 4.438, 4.548) * .985;
    const doubleBlink = !state.reducedMotion && Math.abs(blinkIndex % 5) === 3
      ? blinkPulse(blinkClock, 3.54, 3.62, 3.68, 3.79)
      : 0;
    setWeight(this.bindings, 'blinkLeft', Math.max(mainLeft, doubleBlink));
    setWeight(this.bindings, 'blinkRight', Math.max(mainRight, doubleBlink * .97));

    // Eyes use authored bones instead of shifting an iris texture. The saccade
    // targets are deterministic, held briefly, and smoothly transitioned. A
    // caller-supplied gaze offset (bandmate/audience/fretboard) is layered on top.
    const saccadeClock = Math.max(0, t + state.phase * .23) / 1.65;
    const saccadeSlot = Math.floor(saccadeClock);
    const saccadeProgress = saccadeClock - saccadeSlot;
    const saccadeBlend = T.MathUtils.smoothstep(saccadeProgress, 0, .16);
    const saccade = (slot: number, axis: number) =>
      (deterministicUnit(slot * 2.17 + state.phase * 3.11 + axis * 19.37) * 2 - 1)
      * (axis === 0 ? .046 : .027);
    const naturalYaw = state.reducedMotion
      ? 0
      : T.MathUtils.lerp(saccade(saccadeSlot - 1, 0), saccade(saccadeSlot, 0), saccadeBlend);
    const naturalPitch = state.reducedMotion
      ? 0
      : T.MathUtils.lerp(saccade(saccadeSlot - 1, 1), saccade(saccadeSlot, 1), saccadeBlend);
    const gazeYaw = T.MathUtils.clamp(
      (state.reducedMotion ? 0 : state.gazeYaw ?? 0) + naturalYaw,
      -.24,
      .24,
    );
    const gazePitch = T.MathUtils.clamp(
      (state.reducedMotion ? 0 : state.gazePitch ?? 0) + naturalPitch,
      -.15,
      .15,
    );
    for (const eye of this.eyes) {
      const convergence = state.reducedMotion ? 0 : eye.side === 'L' ? -.008 : .008;
      eye.bone.quaternion.copy(eye.rest).multiply(
        new T.Quaternion().setFromEuler(new T.Euler(gazePitch, gazeYaw + convergence, 0, 'XYZ')),
      );
    }

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

    const articulation = sampleAvatarV2VocalArticulation(t, state.phase, vocal, state.energy);
    const jawAmount = vocal * articulation.jawScale;
    setWeight(this.bindings, 'jawOpen', jawAmount);
    if (this.jaw) {
      const angle = state.reducedMotion ? 0 : jawAmount * .16;
      this.jaw.bone.quaternion.copy(this.jaw.rest).multiply(
        new T.Quaternion().setFromEuler(new T.Euler(angle, 0, 0, 'XYZ')),
      );
      this.jaw.bone.userData.rockmundoAvatarV2JawAngle = angle;
    }
    const micro = state.reducedMotion
      ? 0
      : (.5 + Math.sin(t * .43 + state.phase * 1.91) * .5) * .018;
    setWeight(
      this.bindings,
      'mouthSmile',
      vocalActive
        ? T.MathUtils.clamp(.045 + phrasePulse * .10 + state.energy * .05 - vocal * .035 + micro * .22, 0, .22)
        : 0,
    );

    const squint = vocal * (.08 + state.energy * .22) + phrasePulse * state.energy * .08 + micro;
    setWeight(this.bindings, 'eyeSquintLeft', squint * .96);
    setWeight(this.bindings, 'eyeSquintRight', squint);
    setWeight(this.bindings, 'cheekSquintLeft', faceEnergy * (.08 + phrasePulse * .12) + micro * .42);
    setWeight(this.bindings, 'cheekSquintRight', faceEnergy * (.075 + phrasePulse * .115) + micro * .39);

    const browLift = vocal * (.04 + state.opening * .15) * (1 - state.energy * .28) + micro * .32;
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

    // Use a deterministic syllable plan rather than cycling through vowels in a
    // fixed order. This reads less mechanically in close-up while preserving exact
    // seek/replay reconstruction for gigs and television archives.
    for (const viseme of VOCAL_VISEMES) {
      setWeight(this.bindings, viseme, articulation.visemes[viseme]);
    }
    setWeight(this.bindings, 'mouthFunnel', articulation.funnel);
    setWeight(this.bindings, 'mouthPucker', articulation.pucker);
    setWeight(this.bindings, 'mouthStretchLeft', articulation.stretchLeft);
    setWeight(this.bindings, 'mouthStretchRight', articulation.stretchRight);
  }

  reset() {
    for (const expression of Object.keys(ALIASES) as AvatarV2Expression[]) {
      setWeight(this.bindings, expression, 0);
    }
    for (const eye of this.eyes) eye.bone.quaternion.copy(eye.rest);
    if (this.jaw) {
      this.jaw.bone.quaternion.copy(this.jaw.rest);
      this.jaw.bone.userData.rockmundoAvatarV2JawAngle = 0;
    }
  }
}

export function createAvatarV2ExpressionController(root: T.Object3D) {
  if (root.userData.rockmundoAvatarEngine !== 'rockmundo-v2') return null;
  const controller = new AvatarV2ExpressionController(root);
  return controller.hasCloseUpFace ? controller : null;
}
