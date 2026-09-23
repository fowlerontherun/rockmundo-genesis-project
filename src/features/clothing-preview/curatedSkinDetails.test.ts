import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { addCuratedSkinDetails } from './curatedSkinDetails';

function bones() {
  const map = new Map<string, T.Bone>();
  for (const name of ['Hips','Spine1','Spine2','Hand.L','Hand.R']) {
    const bone = new T.Bone();
    bone.name = name;
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

function clothing(keys: string[]) {
  return keys.map((key, index) => ({
    item: {
      id: `item-${index}`,
      curated_asset_key: key,
      curated_asset_status: 'published',
    },
    variant: undefined,
  })) as any;
}

describe('curated punk detail skins', () => {
  it('surface-binds safety pins and patch-jacket hardware instead of floating offsets', () => {
    const root = new T.Group();
    const rig = bones();
    for (const bone of rig.values()) root.add(bone);
    addBodySurface(root, rig.get('Spine2')!);

    addCuratedSkinDetails(root, rig, clothing([
      'clothing.punk.safety-pin-tee',
      'clothing.punk.patch-jacket',
    ]), 'ultra');

    const pins: T.Object3D[] = [];
    const patches: T.Object3D[] = [];
    const studs: T.Object3D[] = [];
    const stitches: T.Object3D[] = [];
    const clasps: T.Object3D[] = [];
    root.traverse(node => {
      if (node.name === 'curated-safety-pin') pins.push(node);
      if (node.name === 'curated-jacket-patch') patches.push(node);
      if (node.name === 'curated-jacket-stud') studs.push(node);
      if (node.name === 'curated-jacket-patch-stitching') stitches.push(node);
      if (node.name === 'curated-safety-pin-clasp') clasps.push(node);
    });

    expect(pins).toHaveLength(3);
    expect(patches).toHaveLength(3);
    expect(studs).toHaveLength(6);
    expect(stitches).toHaveLength(3);
    expect(clasps).toHaveLength(3);
    [...pins, ...patches, ...studs].forEach(node => {
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
});
