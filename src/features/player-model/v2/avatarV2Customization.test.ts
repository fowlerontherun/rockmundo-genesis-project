import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { defaultAppearance } from '../appearance';
import { applyAvatarV2Customization } from './avatarV2Customization';

function customizableModel() {
  const root = new T.Group();
  const mesh = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial());
  mesh.morphTargetDictionary = {
    bodySlim: 0,
    bodyBroad: 1,
    muscleToned: 2,
    muscleAthletic: 3,
    muscleMuscular: 4,
    muscleBodybuilder: 5,
    faceOval: 6,
    faceAngular: 7,
    faceSoft: 8,
    faceWide: 9,
  };
  mesh.morphTargetInfluences = Array(10).fill(0);
  root.add(mesh);
  return { root, mesh };
}

describe('Avatar V2 authored customization morphs', () => {
  it('uses the broad body morph without requiring whole-skeleton width scaling', () => {
    const { root, mesh } = customizableModel();
    const appearance = defaultAppearance('broad-v2');
    appearance.body.build = 1.15;

    const result = applyAvatarV2Customization(root, appearance);
    expect(result.bodyBuildApplied).toBe(true);
    expect(mesh.morphTargetInfluences![1]).toBeCloseTo(1);
    expect(mesh.morphTargetInfluences![0]).toBe(0);
    expect(root.userData.rockmundoV2UsesBuildMorph).toBe(true);
  });

  it('uses the slim body morph for narrow builds', () => {
    const { root, mesh } = customizableModel();
    const appearance = defaultAppearance('slim-v2');
    appearance.body.build = .85;

    applyAvatarV2Customization(root, appearance);
    expect(mesh.morphTargetInfluences![0]).toBeCloseTo(1);
    expect(mesh.morphTargetInfluences![1]).toBe(0);
  });

  it('maps the existing face-shape choice onto authored V2 head morphs', () => {
    const { root, mesh } = customizableModel();
    const appearance = defaultAppearance('angular-v2');
    appearance.head.faceShape = 'angular';

    const result = applyAvatarV2Customization(root, appearance);
    expect(result.faceShapeApplied).toBe(true);
    expect(mesh.morphTargetInfluences![7]).toBe(1);
    expect(mesh.morphTargetInfluences![6]).toBe(0);
    expect(mesh.morphTargetInfluences![8]).toBe(0);
    expect(mesh.morphTargetInfluences![9]).toBe(0);
  });

  it('applies muscle definition independently from body width', () => {
    const { root, mesh } = customizableModel();
    const appearance = defaultAppearance('muscle-v2');
    appearance.body.build = .9;
    appearance.body.muscle = 'bodybuilder';

    const result = applyAvatarV2Customization(root, appearance);
    expect(mesh.morphTargetInfluences![0]).toBeCloseTo(.6667, 3);
    expect(mesh.morphTargetInfluences![5]).toBe(1);
    expect(result.bodyBuildApplied).toBe(true);
    expect(result.muscleApplied).toBe(true);
    expect(root.userData.rockmundoV2UsesMuscleMorph).toBe(true);
  });

  it('reports a missing requested muscle morph without altering the build fallback', () => {
    const root = new T.Group();
    const mesh = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial());
    mesh.morphTargetDictionary = { bodySlim: 0, faceWide: 1 };
    mesh.morphTargetInfluences = [0, 0];
    root.add(mesh);

    const appearance = defaultAppearance('missing-muscle-v2');
    appearance.body.build = .9;
    appearance.body.muscle = 'athletic';
    const result = applyAvatarV2Customization(root, appearance);
    expect(result.bodyBuildApplied).toBe(true);
    expect(result.muscleApplied).toBe(false);
  });

  it('reports fallback when a requested build morph is absent', () => {
    const root = new T.Group();
    const mesh = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial());
    mesh.morphTargetDictionary = { faceWide: 0 };
    mesh.morphTargetInfluences = [0];
    root.add(mesh);

    const appearance = defaultAppearance('fallback-v2');
    appearance.body.build = 1.12;
    const result = applyAvatarV2Customization(root, appearance);
    expect(result.bodyBuildApplied).toBe(false);
    expect(root.userData.rockmundoV2UsesBuildMorph).toBe(false);
  });
});
