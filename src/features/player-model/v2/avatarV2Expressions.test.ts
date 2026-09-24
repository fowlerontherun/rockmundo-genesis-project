import { describe, expect, it } from 'vitest';
import * as T from 'three';
import {
  AvatarV2ExpressionController,
  collectAvatarV2ExpressionBindings,
  createAvatarV2ExpressionController,
  sampleAvatarV2VocalArticulation,
} from './avatarV2Expressions';

function face() {
  const root = new T.Group();
  root.userData.rockmundoAvatarEngine = 'rockmundo-v2';
  const mesh = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial());
  mesh.morphTargetDictionary = {
    eyeBlinkLeft: 0,
    eyeBlinkRight: 1,
    jaw_open: 2,
    smile: 3,
    viseme_aa: 4,
    viseme_ee: 5,
    viseme_ih: 6,
    viseme_oh: 7,
    viseme_ou: 8,
    mouth_funnel: 9,
    mouth_pucker: 10,
    eyeSquintLeft: 11,
    eyeSquintRight: 12,
    browInnerUp: 13,
    browDownLeft: 14,
    browDownRight: 15,
    cheekSquintLeft: 16,
    cheekSquintRight: 17,
    mouthStretchLeft: 18,
    mouthStretchRight: 19,
  };
  mesh.morphTargetInfluences = Array(20).fill(0);
  root.add(mesh);

  const leftEye = new T.Bone();
  leftEye.name = 'Eye.L';
  const rightEye = new T.Bone();
  rightEye.name = 'Eye.R';
  root.add(leftEye, rightEye);
  return { root, mesh, leftEye, rightEye };
}

describe('Avatar V2 facial expressions', () => {
  it('maps common authored morph aliases onto RockMundo expressions', () => {
    const { root } = face();
    const bindings = collectAvatarV2ExpressionBindings(root);
    expect(bindings.blinkLeft).toHaveLength(1);
    expect(bindings.blinkRight).toHaveLength(1);
    expect(bindings.jawOpen).toHaveLength(1);
    expect(bindings.mouthSmile).toHaveLength(1);
    expect(bindings.visemeAA).toHaveLength(1);
    expect(bindings.visemeOU).toHaveLength(1);
    expect(bindings.eyeSquintLeft).toHaveLength(1);
    expect(bindings.browInnerUp).toHaveLength(1);
    expect(bindings.cheekSquintRight).toHaveLength(1);
    expect(bindings.mouthStretchLeft).toHaveLength(1);
  });

  it('reconstructs the same vocal articulation exactly after a seek', () => {
    const first = sampleAvatarV2VocalArticulation(12.345, .37, .84, .9);
    const replayed = sampleAvatarV2VocalArticulation(12.345, .37, .84, .9);
    expect(replayed).toEqual(first);
  });

  it('uses a varied deterministic syllable plan instead of cycling vowels in order', () => {
    const dominant = Array.from({ length: 12 }, (_, index) => {
      const sample = sampleAvatarV2VocalArticulation(index * .31, .23, .9, .82);
      return Object.entries(sample.visemes)
        .sort((a, b) => b[1] - a[1])[0]?.[0];
    }).filter(Boolean);

    expect(new Set(dominant).size).toBeGreaterThanOrEqual(3);
    const canonicalCycle = ['visemeAA', 'visemeEE', 'visemeIH', 'visemeOH', 'visemeOU'];
    expect(dominant.slice(0, 5)).not.toEqual(canonicalCycle);
  });

  it('introduces brief consonant-like closures without making the jaw non-finite', () => {
    const samples = Array.from({ length: 80 }, (_, index) =>
      sampleAvatarV2VocalArticulation(index * .04, .61, .92, 1),
    );
    expect(samples.every(sample => Number.isFinite(sample.jawScale))).toBe(true);
    expect(Math.min(...samples.map(sample => sample.jawScale))).toBeLessThan(.7);
    expect(Math.max(...samples.map(sample => sample.jawScale))).toBeLessThanOrEqual(1);
  });

  it('drives jaw and smoothly blends adjacent visemes while a performer is singing', () => {
    const { root, mesh } = face();
    const controller = new AvatarV2ExpressionController(root);
    expect(controller.hasCloseUpFace).toBe(true);

    controller.update({
      seconds: 1.2,
      phase: .3,
      vocalActive: true,
      opening: .8,
      energy: .9,
      reducedMotion: false,
    });

    expect(mesh.morphTargetInfluences![2]).toBeGreaterThan(.5);
    const visemeWeights = mesh.morphTargetInfluences!.slice(4, 9);
    const activeVisemes = visemeWeights.filter(value => value > 0);
    expect(activeVisemes.length).toBeGreaterThanOrEqual(1);
    expect(activeVisemes.length).toBeLessThanOrEqual(2);
    expect(activeVisemes.reduce((sum, value) => sum + value, 0)).toBeGreaterThan(.4);
  });

  it('adds cheek, eye and brow tension during energetic vocals', () => {
    const { root, mesh } = face();
    const controller = new AvatarV2ExpressionController(root);
    controller.update({
      seconds: .9,
      phase: .15,
      vocalActive: true,
      opening: .9,
      energy: 1,
      reducedMotion: false,
    });

    expect(mesh.morphTargetInfluences![11]).toBeGreaterThan(0);
    expect(mesh.morphTargetInfluences![12]).toBeGreaterThan(0);
    expect(mesh.morphTargetInfluences![14]).toBeGreaterThan(0);
    expect(mesh.morphTargetInfluences![15]).toBeGreaterThan(0);
    expect(mesh.morphTargetInfluences![16]).toBeGreaterThan(0);
    expect(mesh.morphTargetInfluences![17]).toBeGreaterThan(0);
  });

  it('moves authored eye bones with deterministic gaze and restores them on reset', () => {
    const { root, leftEye, rightEye } = face();
    const controller = new AvatarV2ExpressionController(root);
    const leftRest = leftEye.quaternion.clone();
    const rightRest = rightEye.quaternion.clone();

    controller.update({
      seconds: 3.1,
      phase: .4,
      vocalActive: false,
      opening: 0,
      energy: .7,
      reducedMotion: false,
      gazeYaw: .14,
      gazePitch: -.06,
    });

    expect(leftEye.quaternion.equals(leftRest)).toBe(false);
    expect(rightEye.quaternion.equals(rightRest)).toBe(false);
    expect(leftEye.quaternion.angleTo(rightEye.quaternion)).toBeGreaterThan(0);

    controller.reset();
    expect(leftEye.quaternion.equals(leftRest)).toBe(true);
    expect(rightEye.quaternion.equals(rightRest)).toBe(true);
  });

  it('keeps singing mouth closed while idle micro-expressions stay subtle', () => {
    const { root, mesh } = face();
    const controller = new AvatarV2ExpressionController(root);
    controller.update({
      seconds: 2,
      phase: 0,
      vocalActive: false,
      opening: 1,
      energy: 1,
      reducedMotion: false,
    });
    expect(mesh.morphTargetInfluences![2]).toBe(0);
    expect(mesh.morphTargetInfluences!.slice(4, 9).every(value => value === 0)).toBe(true);
    expect(Math.max(...mesh.morphTargetInfluences!.slice(11, 20))).toBeLessThan(.04);
  });

  it('keeps eye bones at rest when reduced motion is requested', () => {
    const { root, leftEye, rightEye } = face();
    const controller = new AvatarV2ExpressionController(root);
    const leftRest = leftEye.quaternion.clone();
    const rightRest = rightEye.quaternion.clone();

    controller.update({
      seconds: 10,
      phase: .7,
      vocalActive: false,
      opening: 0,
      energy: 1,
      reducedMotion: true,
      gazeYaw: .2,
      gazePitch: .1,
    });

    expect(leftEye.quaternion.equals(leftRest)).toBe(true);
    expect(rightEye.quaternion.equals(rightRest)).toBe(true);
  });

  it('only creates the V2 controller for certified V2 model roots', () => {
    const { root } = face();
    expect(createAvatarV2ExpressionController(root)).toBeInstanceOf(AvatarV2ExpressionController);
    root.userData.rockmundoAvatarEngine = 'legacy-v1';
    expect(createAvatarV2ExpressionController(root)).toBeNull();
  });
});
