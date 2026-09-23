import { describe, expect, it } from 'vitest';
import * as T from 'three';
import {
  AvatarV2ExpressionController,
  collectAvatarV2ExpressionBindings,
  createAvatarV2ExpressionController,
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
  };
  mesh.morphTargetInfluences = Array(11).fill(0);
  root.add(mesh);
  return { root, mesh };
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
  });

  it('drives jaw and one viseme while a performer is singing', () => {
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
    expect(visemeWeights.filter(value => value > 0)).toHaveLength(1);
  });

  it('keeps singing mouth closed when vocals are inactive', () => {
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
  });

  it('only creates the V2 controller for certified V2 model roots', () => {
    const { root } = face();
    expect(createAvatarV2ExpressionController(root)).toBeInstanceOf(AvatarV2ExpressionController);
    root.userData.rockmundoAvatarEngine = 'legacy-v1';
    expect(createAvatarV2ExpressionController(root)).toBeNull();
  });
});
