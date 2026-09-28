import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { auditAvatarV2Face, REQUIRED_FACE_CHANNELS, REQUIRED_HEAD_ANCHORS } from './avatarV2FaceAudit';

function candidate() {
  const root = new T.Group();
  for (const name of REQUIRED_HEAD_ANCHORS) {
    const bone = new T.Bone();
    bone.name = name;
    root.add(bone);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  geometry.morphAttributes.position = REQUIRED_FACE_CHANNELS.map(() =>
    new T.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
  );
  const face = new T.Mesh(geometry, new T.MeshStandardMaterial());
  face.name = 'face';
  face.morphTargetDictionary = Object.fromEntries(REQUIRED_FACE_CHANNELS.map((name, i) => [name, i]));
  face.morphTargetInfluences = REQUIRED_FACE_CHANNELS.map(() => 0);
  root.add(face);
  return { root, face };
}

describe('Avatar V2 Phase 2 facial candidate audit', () => {
  it('accepts complete, finite facial morphs and independent anchors', () => {
    expect(auditAvatarV2Face(candidate().root)).toEqual({
      passed: true, missingChannels: [], missingAnchors: [],
      duplicateAnchors: [], invalidMorphTargets: [],
    });
  });

  it('reports missing channels and missing ear anchors', () => {
    const { root, face } = candidate();
    delete face.morphTargetDictionary!.jawOpen;
    root.remove(root.getObjectByName('EarAnchor.R')!);
    const result = auditAvatarV2Face(root);
    expect(result.passed).toBe(false);
    expect(result.missingChannels).toContain('jawOpen');
    expect(result.missingAnchors).toContain('EarAnchor.R');
  });

  it('rejects duplicate anchors and invalid target lengths', () => {
    const { root, face } = candidate();
    const extra = new T.Bone();
    extra.name = 'Eye.L';
    root.add(extra);
    face.geometry.morphAttributes.position[face.morphTargetDictionary!.jawOpen] =
      new T.Float32BufferAttribute([0, 0, 0], 3);
    const result = auditAvatarV2Face(root);
    expect(result.passed).toBe(false);
    expect(result.duplicateAnchors).toContain('Eye.L');
    expect(result.invalidMorphTargets).toContain('face:jawOpen');
    expect(result.missingChannels).toContain('jawOpen');
  });

  it('rejects non-finite morph coordinates', () => {
    const { root, face } = candidate();
    face.geometry.morphAttributes.position[face.morphTargetDictionary!.jawOpen].setX(0, Number.NaN);
    const result = auditAvatarV2Face(root);
    expect(result.passed).toBe(false);
    expect(result.invalidMorphTargets).toContain('face:jawOpen');
  });
});
