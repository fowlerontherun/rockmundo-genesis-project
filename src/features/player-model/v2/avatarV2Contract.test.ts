import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { defaultAppearance } from '../appearance';
import {
  AVATAR_V2_BODY_REGIONS,
  AVATAR_V2_CLOSEUP_BONE_ALIASES,
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
  for (const aliases of Object.values(AVATAR_V2_CLOSEUP_BONE_ALIASES)) {
    const bone = new T.Bone();
    bone.name = aliases[0];
    root.add(bone);
    bones.push(bone);
  }

  const geometry = new T.BoxGeometry(.5, 1.7, .25, 2, 4, 2);
  const count = geometry.getAttribute('position').count;
  geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(new Uint16Array(count * 4), 4));
  const weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) weights[i * 4] = 1;
  geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));

  const materials = ['RMV2_Skin', 'RMV2_Eyes', 'RMV2_Teeth', 'RMV2_Tongue'].map(name => {
    const material = new T.MeshStandardMaterial({ color: '#cccccc' });
    material.name = name;
    return material;
  });
  const mesh = new T.SkinnedMesh(geometry, materials);
  mesh.name = 'RMV2_Body';
  mesh.morphTargetDictionary = {
    blinkLeft: 0,
    blinkRight: 1,
    jawOpen: 2,
    mouthSmile: 3,
    muscleToned: 4,
    muscleAthletic: 5,
    muscleMuscular: 6,
    muscleBodybuilder: 7,
  };
  mesh.morphTargetInfluences = Array(8).fill(0);
  mesh.bind(new T.Skeleton(bones));
  root.add(mesh);

  const headGeometry = new T.BoxGeometry(.38, .5, .34, 2, 3, 2);
  const headCount = headGeometry.attributes.position.count;
  headGeometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(new Uint16Array(headCount * 4), 4));
  const headWeights = new Float32Array(headCount * 4);
  for (let index = 0; index < headCount; index++) headWeights[index * 4] = 1;
  headGeometry.setAttribute('skinWeight', new T.Float32BufferAttribute(headWeights, 4));
  const headMaterial = new T.MeshStandardMaterial({ color: '#cccccc' });
  headMaterial.name = 'RMV2_Skin';
  const headSurface = new T.SkinnedMesh(headGeometry, headMaterial);
  headSurface.name = 'RMV2_HeadSurface';
  headSurface.position.y = 1.45;
  headSurface.bind(new T.Skeleton(bones));
  root.add(headSurface);

  for (const region of AVATAR_V2_BODY_REGIONS) {
    const partGeometry = new T.BoxGeometry(.02, .02, .02);
    const partCount = partGeometry.attributes.position.count;
    partGeometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(new Uint16Array(partCount * 4), 4));
    const partWeights = new Float32Array(partCount * 4);
    for (let index = 0; index < partCount; index++) partWeights[index * 4] = 1;
    partGeometry.setAttribute('skinWeight', new T.Float32BufferAttribute(partWeights, 4));
    const partMaterial = new T.MeshStandardMaterial({ color: '#cccccc' });
    partMaterial.name = 'RMV2_Skin';
    const part = new T.SkinnedMesh(
      partGeometry,
      partMaterial,
    );
    part.name = `RMV2_Body_${region}`;
    part.userData.rockmundoBodyRegion = region;
    part.bind(new T.Skeleton(bones));
    root.add(part);
  }

  root.updateMatrixWorld(true);
  return root;
}

describe('Avatar V2 mesh contract', () => {
  it('accepts a compact skinned humanoid with the required rig and facial targets', () => {
    const report = validateAvatarV2Scene(validScene(), 'masculine', 0);
    expect(report.valid).toBe(true);
    expect(report.skinnedMeshes).toBe(2 + AVATAR_V2_BODY_REGIONS.length);
    expect(report.issues.filter(issue => issue.level === 'error')).toEqual([]);
    expect(Object.keys(report.boneMap)).toHaveLength(AVATAR_V2_REQUIRED_BONES.length);
  });

  it('fails a body region that cannot render as bare skin', () => {
    const scene = validScene();
    const torso = scene.getObjectByName('RMV2_Body_torso') as T.SkinnedMesh;
    (torso.material as T.MeshStandardMaterial).name = 'RMV2_Garment';
    const report = validateAvatarV2Scene(scene, 'masculine', 0);
    expect(report.valid).toBe(false);
    expect(report.issues.some(issue => issue.code === 'missing-bare-skin-region:torso')).toBe(true);
  });

  it('fails candidates without the authored muscle set', () => {
    const scene = validScene();
    const mesh = scene.getObjectByName('RMV2_Body') as T.SkinnedMesh;
    delete mesh.morphTargetDictionary!.muscleAthletic;
    const report = validateAvatarV2Scene(scene, 'masculine', 0);
    expect(report.valid).toBe(false);
    expect(report.issues.some(issue => issue.code === 'missing-muscle-morph:muscleAthletic')).toBe(true);
  });

  it('fails close-up assets without an authored skinned head surface', () => {
    const scene = validScene();
    scene.remove(scene.getObjectByName('RMV2_HeadSurface')!);
    const report = validateAvatarV2Scene(scene, 'masculine', 0);
    expect(report.valid).toBe(false);
    expect(report.issues.some(issue => issue.code === 'missing-head-surface' && issue.level === 'error')).toBe(true);
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
