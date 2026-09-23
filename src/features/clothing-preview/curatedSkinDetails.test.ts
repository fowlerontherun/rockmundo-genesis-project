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

function clothing(keys: string[]) {
  return keys.map((key, index) => ({
    item: { id: `item-${index}`, curated_asset_key: key },
    variant: undefined,
  })) as any;
}

describe('curated punk detail skins', () => {
  it('adds safety pins and patch jacket details without garment body geometry', () => {
    const root = new T.Group();
    const rig = bones();
    for (const bone of rig.values()) root.add(bone);
    root.updateMatrixWorld(true);

    addCuratedSkinDetails(root, rig, clothing([
      'clothing.punk.safety-pin-tee',
      'clothing.punk.patch-jacket',
    ]));

    const names: string[] = [];
    root.traverse(node => names.push(node.name));
    expect(names.filter(name => name === 'curated-safety-pin')).toHaveLength(3);
    expect(names.filter(name => name === 'curated-jacket-patch')).toHaveLength(3);
    expect(names.filter(name => name === 'curated-jacket-stud')).toHaveLength(6);
  });

  it('adds belt and both wrist cuffs to rig bones', () => {
    const root = new T.Group();
    const rig = bones();
    for (const bone of rig.values()) root.add(bone);
    root.updateMatrixWorld(true);

    addCuratedSkinDetails(root, rig, clothing([
      'clothing.punk.double-eyelet-belt',
      'clothing.punk.wrist-cuffs',
    ]));

    expect(root.getObjectByName('curated-double-eyelet-belt')).toBeTruthy();
    expect(root.getObjectByName('curated-wrist-cuff-l')).toBeTruthy();
    expect(root.getObjectByName('curated-wrist-cuff-r')).toBeTruthy();
  });
});
