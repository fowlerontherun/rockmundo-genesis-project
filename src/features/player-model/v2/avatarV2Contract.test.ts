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
  const headBone = bones.find(bone => bone.name === 'head')!;
  for (const [semantic, aliases] of Object.entries(AVATAR_V2_CLOSEUP_BONE_ALIASES)) {
    const bone = new T.Bone();
    bone.name = aliases[0];
    if (semantic === 'leftEye' || semantic === 'rightEye') headBone.add(bone);
    else root.add(bone);
    bones.push(bone);
  }

  const geometry = new T.BoxGeometry(.5, 1.7, .25, 2, 4, 2);
  const count = geometry.getAttribute('position').count;
  geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(new Uint16Array(count * 4), 4));
  const weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) weights[i * 4] = 1;
  geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));

  const materials = ['RMV2_Skin', 'RMV2_Eyes', 'RMV2_Cornea', 'RMV2_Teeth', 'RMV2_Tongue', 'RMV2_MouthInterior'].map(name => {
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
    poseShoulderLeft: 8,
    poseShoulderRight: 9,
    poseElbowLeft: 10,
    poseElbowRight: 11,
    poseHipLeft: 12,
    poseHipRight: 13,
    poseKneeLeft: 14,
    poseKneeRight: 15,
  };
  mesh.morphTargetInfluences = Array(16).fill(0);
  geometry.morphTargetsRelative = true;
  geometry.morphAttributes.position = Array.from({ length: 16 }, (_, morphIndex) => {
    const delta = new Float32Array(count * 3);
    delta[(morphIndex % count) * 3] = .002 + morphIndex * .00001;
    return new T.Float32BufferAttribute(delta, 3);
  });
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

function continuousRegionScene() {
  const root = validScene();
  for (const region of AVATAR_V2_BODY_REGIONS) {
    root.getObjectByName(`RMV2_Body_${region}`)?.removeFromParent();
  }

  const geometry = new T.BoxGeometry(.48, 1.55, .25, 2, 4, 2);
  const count = geometry.getAttribute('position').count;
  geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(new Uint16Array(count * 4), 4));
  const weights = new Float32Array(count * 4);
  for (let index = 0; index < count; index++) weights[index * 4] = 1;
  geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));

  const materials = AVATAR_V2_BODY_REGIONS.map(region => {
    const material = new T.MeshStandardMaterial({ color: '#cccccc' });
    material.name = `RMV2_Skin_${region}`;
    return material;
  });

  geometry.clearGroups();
  const indexCount = geometry.index!.count;
  let start = 0;
  AVATAR_V2_BODY_REGIONS.forEach((region, materialIndex) => {
    const remainingRegions = AVATAR_V2_BODY_REGIONS.length - materialIndex;
    const remaining = indexCount - start;
    const countForRegion = materialIndex === AVATAR_V2_BODY_REGIONS.length - 1
      ? remaining
      : Math.max(3, Math.floor(remaining / remainingRegions / 3) * 3);
    geometry.addGroup(start, countForRegion, materialIndex);
    start += countForRegion;
  });

  const bones: T.Bone[] = [];
  root.traverse(node => { if (node instanceof T.Bone) bones.push(node); });
  const mesh = new T.SkinnedMesh(geometry, materials);
  mesh.name = 'RMV2_ContinuousBody';
  mesh.bind(new T.Skeleton(bones));
  root.add(mesh);
  root.updateMatrixWorld(true);
  return { root, mesh, materials };
}

describe('Avatar V2 mesh contract', () => {
  it('accepts a compact skinned humanoid with the required rig and facial targets', () => {
    const report = validateAvatarV2Scene(validScene(), 'masculine', 0);
    expect(report.valid).toBe(true);
    expect(report.skinnedMeshes).toBe(2 + AVATAR_V2_BODY_REGIONS.length);
    expect(report.issues.filter(issue => issue.level === 'error')).toEqual([]);
    expect(Object.keys(report.boneMap)).toHaveLength(AVATAR_V2_REQUIRED_BONES.length);
  });

  it('accepts body-region materials on one continuous skinned body mesh', () => {
    const { root } = continuousRegionScene();
    const report = validateAvatarV2Scene(root, 'masculine', 0);
    expect(report.valid).toBe(true);
    expect(report.issues.filter(issue => issue.code.startsWith('missing-body-region:'))).toEqual([]);
  });

  it('does not count an unused region material as authored body coverage', () => {
    const { root, mesh, materials } = continuousRegionScene();
    const feetIndex = AVATAR_V2_BODY_REGIONS.indexOf('feet');
    const retainedGroups = mesh.geometry.groups.filter(group => group.materialIndex !== feetIndex);
    mesh.geometry.clearGroups();
    retainedGroups.forEach(group => mesh.geometry.addGroup(group.start, group.count, group.materialIndex));
    materials[feetIndex].name = 'RMV2_Skin_feet';
    const report = validateAvatarV2Scene(root, 'masculine', 0);
    expect(report.valid).toBe(false);
    expect(report.issues.some(issue => issue.code === 'missing-body-region:feet')).toBe(true);
  });

  it('fails a body region that cannot render as bare skin', () => {
    const scene = validScene();
    const torso = scene.getObjectByName('RMV2_Body_torso') as T.SkinnedMesh;
    (torso.material as T.MeshStandardMaterial).name = 'RMV2_Garment';
    const report = validateAvatarV2Scene(scene, 'masculine', 0);
    expect(report.valid).toBe(false);
    expect(report.issues.some(issue => issue.code === 'missing-bare-skin-region:torso')).toBe(true);
  });

  it('enforces complete bare skin on balanced LOD2 assets', () => {
    const scene = validScene();
    const torso = scene.getObjectByName('RMV2_Body_torso') as T.SkinnedMesh;
    (torso.material as T.MeshStandardMaterial).name = 'RMV2_Garment';
    const report = validateAvatarV2Scene(scene, 'masculine', 2);
    expect(report.valid).toBe(false);
    expect(report.issues.some(issue => issue.code === 'missing-bare-skin-region:torso')).toBe(true);
  });

  it('enforces every authored body region on crowd LOD3 assets', () => {
    const scene = validScene();
    scene.remove(scene.getObjectByName('RMV2_Body_feet')!);
    const report = validateAvatarV2Scene(scene, 'masculine', 3);
    expect(report.valid).toBe(false);
    expect(report.issues.some(issue => issue.code === 'missing-body-region:feet')).toBe(true);
  });

  it('fails candidates without the authored muscle set', () => {
    const scene = validScene();
    const mesh = scene.getObjectByName('RMV2_Body') as T.SkinnedMesh;
    delete mesh.morphTargetDictionary!.muscleAthletic;
    const report = validateAvatarV2Scene(scene, 'masculine', 0);
    expect(report.valid).toBe(false);
    expect(report.issues.some(issue => issue.code === 'missing-muscle-morph:muscleAthletic')).toBe(true);
  });

  it('rejects named muscle morphs that contain no vertex deformation', () => {
    const scene = validScene();
    const mesh = scene.getObjectByName('RMV2_Body') as T.SkinnedMesh;
    const index = mesh.morphTargetDictionary!.muscleAthletic;
    (mesh.geometry.morphAttributes.position[index] as T.BufferAttribute).array.fill(0);
    const report = validateAvatarV2Scene(scene, 'masculine', 0);
    expect(report.valid).toBe(false);
    expect(report.issues.some(issue => issue.code === 'empty-muscle-morph:muscleAthletic')).toBe(true);
  });

  it('rejects named facial targets that contain no vertex deformation', () => {
    const scene = validScene();
    const mesh = scene.getObjectByName('RMV2_Body') as T.SkinnedMesh;
    const index = mesh.morphTargetDictionary!.jawOpen;
    (mesh.geometry.morphAttributes.position[index] as T.BufferAttribute).array.fill(0);
    const report = validateAvatarV2Scene(scene, 'masculine', 0);
    expect(report.valid).toBe(false);
    expect(report.issues.some(issue => issue.code === 'empty-expression:jawOpen')).toBe(true);
  });

  it('rejects named joint correctives that contain no vertex deformation', () => {
    const scene = validScene();
    const mesh = scene.getObjectByName('RMV2_Body') as T.SkinnedMesh;
    const index = mesh.morphTargetDictionary!.poseElbowLeft;
    (mesh.geometry.morphAttributes.position[index] as T.BufferAttribute).array.fill(0);
    const report = validateAvatarV2Scene(scene, 'masculine', 0);
    expect(report.valid).toBe(false);
    expect(report.issues.some(issue => issue.code === 'empty-pose-corrective:poseElbowLeft')).toBe(true);
  });

  it('fails close-up assets when a required joint deformation corrective is missing', () => {
    const scene = validScene();
    const mesh = scene.getObjectByName('RMV2_Body') as T.SkinnedMesh;
    delete mesh.morphTargetDictionary!.poseElbowLeft;
    const report = validateAvatarV2Scene(scene, 'masculine', 0);
    expect(report.valid).toBe(false);
    expect(report.issues.some(issue => issue.code === 'missing-pose-corrective:poseElbowLeft' && issue.level === 'error')).toBe(true);
  });

  it('fails close-up assets without an authored skinned head surface', () => {
    const scene = validScene();
    scene.remove(scene.getObjectByName('RMV2_HeadSurface')!);
    const report = validateAvatarV2Scene(scene, 'masculine', 0);
    expect(report.valid).toBe(false);
    expect(report.issues.some(issue => issue.code === 'missing-head-surface' && issue.level === 'error')).toBe(true);
  });

  it('fails close-up assets whose eye bones are detached from the head hierarchy', () => {
    const scene = validScene();
    const leftEye = scene.getObjectByName('Eye.L') as T.Bone;
    scene.attach(leftEye);
    const report = validateAvatarV2Scene(scene, 'masculine', 0);
    expect(report.valid).toBe(false);
    expect(report.issues.some(issue => issue.code === 'invalid-eye-parent:leftEye')).toBe(true);
  });

  it('fails close-up assets that omit an authored eye bone', () => {
    const scene = validScene();
    scene.getObjectByName('Eye.L')!.removeFromParent();
    const report = validateAvatarV2Scene(scene, 'masculine', 0);
    expect(report.valid).toBe(false);
    expect(report.issues.some(issue => issue.code === 'missing-closeup-bone:leftEye')).toBe(true);
  });

  it('fails close-up assets that omit a distal finger joint', () => {
    const scene = validScene();
    scene.remove(scene.getObjectByName('Index3.L')!);
    const report = validateAvatarV2Scene(scene, 'masculine', 0);
    expect(report.valid).toBe(false);
    expect(report.issues.some(issue => issue.code === 'missing-closeup-bone:leftIndex3')).toBe(true);
  });

  it('fails close-up assets that omit a required facial expression', () => {
    const scene = validScene();
    const mesh = scene.getObjectByName('RMV2_Body') as T.SkinnedMesh;
    delete mesh.morphTargetDictionary!.jawOpen;
    const report = validateAvatarV2Scene(scene, 'masculine', 0);
    expect(report.valid).toBe(false);
    expect(report.issues.some(issue => issue.code === 'missing-expression:jawOpen' && issue.level === 'error')).toBe(true);
  });

  it('fails LOD0 close-ups without cornea or mouth-interior materials', () => {
    const scene = validScene();
    const mesh = scene.getObjectByName('RMV2_Body') as T.SkinnedMesh;
    mesh.material = (mesh.material as T.Material[]).filter(material =>
      material.name !== 'RMV2_Cornea' && material.name !== 'RMV2_MouthInterior'
    );
    const report = validateAvatarV2Scene(scene, 'masculine', 0);
    expect(report.valid).toBe(false);
    expect(report.issues.some(issue => issue.code === 'missing-material-role:cornea')).toBe(true);
    expect(report.issues.some(issue => issue.code === 'missing-material-role:mouthInterior')).toBe(true);
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
