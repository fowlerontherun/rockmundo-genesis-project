import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { addCuratedSkinDetails } from './curatedSkinDetails';
import type { ResolvedEquippedClothing } from './equippedClothing';

function bones() {
  const map = new Map<string, T.Bone>();
  for (const name of ['Hips','Spine1','Spine2','Hand.L','Hand.R','Foot.L','Foot.R']) {
    const bone = new T.Bone();
    bone.name = name;
    if (name === 'Foot.L') bone.position.set(-.12, -.72, 0);
    if (name === 'Foot.R') bone.position.set(.12, -.72, 0);
    map.set(name, bone);
  }
  return map;
}

function addBodySurface(root: T.Group, chest: T.Bone) {
  const geometry = new T.BoxGeometry(.52, .62, .26, 4, 4, 2);
  const count = geometry.attributes.position.count;
  const skinIndex = new Uint16Array(count * 4);
  const skinWeight = new Float32Array(count * 4);
  for (let index = 0; index < count; index++) skinWeight[index * 4] = 1;
  geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(skinWeight, 4));
  const material = new T.MeshStandardMaterial({ color: '#222222' });
  material.name = 'shirt';
  const mesh = new T.SkinnedMesh(geometry, material);
  mesh.name = 'Casual_body_mesh';
  root.add(mesh);
  root.updateMatrixWorld(true);
  mesh.bind(new T.Skeleton([chest]), new T.Matrix4());
  root.updateMatrixWorld(true);
  return mesh;
}

function addFootSurface(root: T.Group, foot: T.Bone, side: 'L' | 'R') {
  const geometry = new T.BoxGeometry(.16, .16, .32, 3, 3, 4);
  const count = geometry.attributes.position.count;
  const skinIndex = new Uint16Array(count * 4);
  const skinWeight = new Float32Array(count * 4);
  for (let index = 0; index < count; index++) skinWeight[index * 4] = 1;
  geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(skinWeight, 4));
  const material = new T.MeshStandardMaterial({ color: '#242424' });
  material.name = 'shoe';
  const mesh = new T.SkinnedMesh(geometry, material);
  mesh.name = `Casual_feet_mesh_${side}`;
  mesh.position.copy(foot.position);
  root.add(mesh);
  root.updateMatrixWorld(true);
  mesh.bind(new T.Skeleton([foot]), mesh.matrixWorld.clone());
  root.updateMatrixWorld(true);
  return mesh;
}

function clothing(keys: string[]) {
  return keys.map((key, index) => ({
    item: {
      id: `item-${index}`,
      curated_asset_key: key,
      curated_asset_status: 'published',
    },
    variant: undefined,
  })) as unknown as ResolvedEquippedClothing[];
}

describe('curated punk detail skins', () => {
  it('surface-binds safety pins and patch-jacket hardware instead of floating offsets', () => {
    const root = new T.Group();
    const rig = bones();
    for (const bone of rig.values()) root.add(bone);
    const chest = rig.get('Spine2');
    if (!chest) throw new Error('Missing chest');
    addBodySurface(root, chest);

    addCuratedSkinDetails(root, rig, clothing([
      'clothing.punk.safety-pin-tee',
      'clothing.punk.patch-jacket',
      'clothing.punk.biker-jacket',
    ]), 'ultra');

    const pins: T.Object3D[] = [];
    const patches: T.Object3D[] = [];
    const studs: T.Object3D[] = [];
    const stitches: T.Object3D[] = [];
    const clasps: T.Object3D[] = [];
    const bikerHardware: T.Object3D[] = [];
    root.traverse(node => {
      if (node.name === 'curated-safety-pin') pins.push(node);
      if (node.name === 'curated-jacket-patch') patches.push(node);
      if (node.name === 'curated-jacket-stud') studs.push(node);
      if (node.name === 'curated-jacket-patch-stitching') stitches.push(node);
      if (node.name === 'curated-safety-pin-clasp') clasps.push(node);
      if (node.name === 'curated-biker-zipper-pull' || node.name === 'curated-biker-lapel-snap') bikerHardware.push(node);
    });

    expect(pins).toHaveLength(3);
    expect(patches).toHaveLength(3);
    expect(studs).toHaveLength(6);
    expect(stitches).toHaveLength(3);
    expect(clasps).toHaveLength(3);
    expect(bikerHardware).toHaveLength(5);
    [...pins, ...patches, ...studs, ...bikerHardware].forEach(node => {
      expect(node.userData.surfaceBound).toBe(true);
      expect(node.userData.surfaceMesh).toBe('Casual_body_mesh');
    });
  });

  it('adds belt and both wrist cuffs to rig bones', () => {
    const root = new T.Group();
    const rig = bones();
    for (const bone of rig.values()) root.add(bone);
    root.updateMatrixWorld(true);

    addCuratedSkinDetails(root, rig, clothing([
      'clothing.punk.double-eyelet-belt',
      'clothing.punk.wrist-cuffs',
    ]), 'high');

    expect(root.getObjectByName('curated-double-eyelet-belt')).toBeTruthy();
    expect(root.getObjectByName('curated-wrist-cuff-l')).toBeTruthy();
    expect(root.getObjectByName('curated-wrist-cuff-r')).toBeTruthy();
  });

  it('surface-binds quality-scaled trainer and combat-boot laces to both feet', () => {
    const root = new T.Group();
    const rig = bones();
    for (const bone of rig.values()) root.add(bone);
    const left = rig.get('Foot.L');
    const right = rig.get('Foot.R');
    if (!left || !right) throw new Error('Missing feet');
    addFootSurface(root, left, 'L');
    addFootSurface(root, right, 'R');

    addCuratedSkinDetails(root, rig, clothing([
      'clothing.starter.canvas-trainers',
      'clothing.punk.combat-boots',
    ]), 'ultra');

    const trainerGroups: T.Object3D[] = [];
    const combatGroups: T.Object3D[] = [];
    const trainerEyelets: T.Object3D[] = [];
    const combatEyelets: T.Object3D[] = [];
    root.traverse(node => {
      if (node.name.startsWith('curated-trainer-laces-')) trainerGroups.push(node);
      if (node.name.startsWith('curated-combat-boot-laces-')) combatGroups.push(node);
      if (node.name === 'curated-trainer-eyelet') trainerEyelets.push(node);
      if (node.name === 'curated-combat-boot-eyelet') combatEyelets.push(node);
    });

    expect(trainerGroups).toHaveLength(2);
    expect(combatGroups).toHaveLength(2);
    expect(trainerEyelets).toHaveLength(12);
    expect(combatEyelets).toHaveLength(24);
    [...trainerGroups, ...combatGroups].forEach(group => {
      expect(group.userData.surfaceBound).toBe(true);
      expect(String(group.userData.surfaceMesh)).toContain('_feet_');
    });
  });

  it.each(['indie', 'electronic', 'metal', 'jazz'])('adds fitted laces for %s genre footwear before the first render', genre => {
    const root = new T.Group();
    const rig = bones();
    for (const bone of rig.values()) root.add(bone);
    for (const side of ['L', 'R'] as const) {
      const foot = rig.get(`Foot.${side}`);
      if (!foot) throw new Error('Missing foot');
      addFootSurface(root, foot, side);
    }
    addCuratedSkinDetails(root, rig, clothing([`clothing.genre.${genre}.footwear`]));
    const prefix = ['indie', 'electronic'].includes(genre) ? 'curated-genre-trainer' : 'curated-genre-boot';
    for (const side of ['l', 'r']) {
      const group = root.getObjectByName(`${prefix}-laces-${side}`);
      expect(group).toBeTruthy();
      expect(group?.userData.surfaceBound).toBe(true);
    }
  });
});
