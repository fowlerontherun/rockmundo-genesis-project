import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { createAvatarV2FaceController, AVATAR_V2_FACE_PRESETS } from './avatarV2FaceController';

function fixture() {
  const root = new T.Group();
  const meshes = Array.from({ length: 2 }, (_, i) => {
    const mesh = new T.Mesh(new T.BoxGeometry(), new T.MeshBasicMaterial());
    mesh.name = `face-${i}`;
    mesh.morphTargetDictionary = { jawOpen: 0, eyeBlinkLeft: 1, eyeBlinkRight: 2 };
    mesh.morphTargetInfluences = [0, 0, 0];
    root.add(mesh);
    return mesh;
  });
  return { root, meshes };
}

describe('Avatar V2 authored facial playback', () => {
  it('returns null when no facial morphs are authored', () => {
    expect(createAvatarV2FaceController(new T.Group())).toBeNull();
  });

  it('applies the same clamped pose to all matching face meshes', () => {
    const { root, meshes } = fixture();
    const controller = createAvatarV2FaceController(root)!;
    controller.setPose({ jawOpen: 2, eyeBlinkLeft: Number.NaN });
    for (const mesh of meshes) expect(mesh.morphTargetInfluences).toEqual([1, 0, 0]);
    controller.setPose(AVATAR_V2_FACE_PRESETS.blink);
    for (const mesh of meshes) expect(mesh.morphTargetInfluences).toEqual([0, 1, 1]);
  });

  it('uses playback delta for deterministic transitions and resets', () => {
    const { root, meshes } = fixture();
    const controller = createAvatarV2FaceController(root)!;
    controller.transitionTo({ jawOpen: 1 }, 2);
    controller.update(.5);
    controller.update(.5);
    expect(meshes[0].morphTargetInfluences![0]).toBeCloseTo(.5);
    controller.update(1);
    expect(meshes[0].morphTargetInfluences![0]).toBe(1);
    controller.reset();
    for (const mesh of meshes) expect(mesh.morphTargetInfluences).toEqual([0, 0, 0]);
  });
});
