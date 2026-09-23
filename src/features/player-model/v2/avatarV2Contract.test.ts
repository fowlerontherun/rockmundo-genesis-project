import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { defaultAppearance } from '../appearance';
import {
  AVATAR_V2_REQUIRED_BONES,
  validateAvatarV2Scene,
} from './avatarV2Contract';
import {
  avatarV2LodForQuality,
  tryAssembleAvatarV2Model,
} from './avatarV2Model';
import { avatarV2Readiness } from './avatarV2Registry';

function validScene() {
  const root = new T.Group();
  root.userData.rockmundoAvatarV2 = { version: '2.0', frame: 'masculine', lod: 0 };

  const bones = AVATAR_V2_REQUIRED_BONES.map(name => {
    const bone = new T.Bone();
    bone.name = name;
    root.add(bone);
    return bone;
  });

  const geometry = new T.BoxGeometry(.5, 1.7, .25, 2, 4, 2);
  const count = geometry.getAttribute('position').count;
  geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(new Uint16Array(count * 4), 4));
  const weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) weights[i * 4] = 1;
  geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));

  const mesh = new T.SkinnedMesh(geometry, new T.MeshStandardMaterial({ color: '#cccccc' }));
  mesh.name = 'RMV2_Body';
  mesh.morphTargetDictionary = {
    blinkLeft: 0,
    blinkRight: 1,
    jawOpen: 2,
    mouthSmile: 3,
  };
  mesh.morphTargetInfluences = [0, 0, 0, 0];
  mesh.bind(new T.Skeleton(bones));
  root.add(mesh);
  root.updateMatrixWorld(true);
  return root;
}

describe('Avatar V2 mesh contract', () => {
  it('accepts a compact skinned humanoid with the required rig and facial targets', () => {
    const report = validateAvatarV2Scene(validScene(), 'masculine', 0);
    expect(report.valid).toBe(true);
    expect(report.skinnedMeshes).toBe(1);
    expect(report.issues.filter(issue => issue.level === 'error')).toEqual([]);
    expect(Object.keys(report.boneMap)).toHaveLength(AVATAR_V2_REQUIRED_BONES.length);
  });

  it('fails close-up assets that omit a required facial expression', () => {
    const scene = validScene();
    const mesh = scene.getObjectByName('RMV2_Body') as T.SkinnedMesh;
    delete mesh.morphTargetDictionary!.jawOpen;
    const report = validateAvatarV2Scene(scene, 'masculine', 0);
    expect(report.valid).toBe(false);
    expect(report.issues.some(issue => issue.code === 'missing-expression:jawOpen' && issue.level === 'error')).toBe(true);
  });

  it('treats missing facial targets as warnings on distant LODs', () => {
    const scene = validScene();
    const mesh = scene.getObjectByName('RMV2_Body') as T.SkinnedMesh;
    mesh.morphTargetDictionary = {};
    const report = validateAvatarV2Scene(scene, 'masculine', 3);
    expect(report.issues.filter(issue => issue.code.startsWith('missing-expression:')).every(issue => issue.level === 'warning')).toBe(true);
  });

  it('maps render quality onto the intended LOD budget', () => {
    expect(avatarV2LodForQuality('cinematic')).toBe(0);
    expect(avatarV2LodForQuality('ultra')).toBe(0);
    expect(avatarV2LodForQuality('high')).toBe(1);
    expect(avatarV2LodForQuality('balanced')).toBe(2);
    expect(avatarV2LodForQuality('crowd')).toBe(3);
  });

  it('keeps production on V1 until validated V2 assets exist', () => {
    const readiness = avatarV2Readiness();
    expect(readiness.productionReady).toBe(false);
    expect(readiness.rolloutEnabled).toBe(false);

    const result = tryAssembleAvatarV2Model(new Map(), defaultAppearance('v2-fallback'), 'high');
    expect(result.model).toBeNull();
    expect(result.reason).toMatch(/No validated Avatar V2/);
  });
});
