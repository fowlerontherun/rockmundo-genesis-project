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
    faceOval: 2,
    faceAngular: 3,
    faceSoft: 4,
    faceWide: 5,
  };
  mesh.morphTargetInfluences = Array(6).fill(0);
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
    expect(mesh.morphTargetInfluences![3]).toBe(1);
    expect(mesh.morphTargetInfluences![2]).toBe(0);
    expect(mesh.morphTargetInfluences![4]).toBe(0);
    expect(mesh.morphTargetInfluences![5]).toBe(0);
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
